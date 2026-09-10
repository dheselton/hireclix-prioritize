/**
 * Helpers to correct misclassified or unlinked career-site support requests.
 * Keeps parent_project_id, client_id, tags, and watchers in sync.
 */
import { supabase } from "@/integrations/supabase/client";
import { updateProject } from "@/lib/pm/api";
import { applyClientWatchers } from "@/lib/pm/clientWatchers";
import { refreshCareerSiteProjects } from "@/lib/pm/clients";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { clientTag } from "@/lib/pm/tags";
import { isCareerSiteRequest } from "@/lib/pm/clients";
import type { RequestType } from "@/lib/pm/requestTypes";
import type { PmProject } from "@/types/pm";

export function isCareerSiteRequestType(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.startsWith("careersite_");
}

export { isDevRequestType } from "@/lib/pm/requestTypes";

export type LinkRequestToSiteInput = {
  requestId: string;
  parentProjectId: string;
  /** When true (default), align the request's client_id to the live site's client. */
  normalizeClient?: boolean;
};

export type LinkRequestToSiteResult = {
  project: PmProject;
  clientNormalized: boolean;
  previousClientId: string | null;
};

/**
 * Link a request to a live career site. Optionally normalizes the request's
 * client to match the site (needed when duplicate client rows share a name).
 */
export async function linkRequestToLiveSiteCorrected(
  input: LinkRequestToSiteInput,
): Promise<LinkRequestToSiteResult> {
  const normalizeClient = input.normalizeClient !== false;

  const [{ data: request, error: reqErr }, { data: site, error: siteErr }] = await Promise.all([
    supabase
      .from("pm_projects")
      .select("*")
      .eq("id", input.requestId)
      .maybeSingle(),
    supabase
      .from("pm_projects")
      .select("id, title, client_id")
      .eq("id", input.parentProjectId)
      .maybeSingle(),
  ]);
  if (reqErr) throw reqErr;
  if (siteErr) throw siteErr;
  if (!request) throw new Error("Request not found");
  if (!site) throw new Error("Live site not found");

  const prev = request as unknown as PmProject;
  const siteClientId = (site as { client_id: string | null }).client_id ?? null;
  const previousClientId = prev.client_id ?? null;
  const clientNormalized =
    normalizeClient && !!siteClientId && siteClientId !== previousClientId;

  const patch: Partial<PmProject> & Record<string, unknown> = {
    parent_project_id: input.parentProjectId,
  };

  if (clientNormalized && siteClientId) {
    patch.client_id = siteClientId;
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", siteClientId)
      .maybeSingle();
    const ct = clientTag((client as { name?: string } | null)?.name);
    const nonClient = (prev.tags ?? []).filter((t) => !t.startsWith("client:"));
    patch.tags = ct ? [...nonClient, ct] : nonClient;
  }

  const project = await updateProject(input.requestId, patch as Partial<PmProject>);

  const requestType =
    typeof (project.custom_fields as { request_type?: string } | null)?.request_type === "string"
      ? (project.custom_fields as { request_type: string }).request_type
      : null;

  if (clientNormalized && siteClientId) {
    await applyClientWatchers(project.id, siteClientId, requestType).catch(() => []);
  }

  emitTasksChanged();
  return { project, clientNormalized, previousClientId };
}

export type CorrectRequestTypeInput = {
  requestId: string;
  requestType: RequestType | string;
  /** Required when switching to a career-site type and a site is known. */
  parentProjectId?: string | null;
  normalizeClient?: boolean;
};

/**
 * Change a request's type. Non-careersite types clear parent_project_id.
 * Careersite types may attach a live site in the same write.
 */
export async function correctRequestType(
  input: CorrectRequestTypeInput,
): Promise<PmProject> {
  const { data: existing, error } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new Error("Request not found");

  const prev = existing as unknown as PmProject;
  const nextType = input.requestType;
  const wasCareer = isCareerSiteRequest(prev.custom_fields);
  const isCareer = isCareerSiteRequestType(nextType);

  const nextFields = {
    ...(prev.custom_fields ?? {}),
    request_type: nextType,
  };

  const patch: Partial<PmProject> & Record<string, unknown> = {
    custom_fields: nextFields,
  };

  if (!isCareer) {
    patch.parent_project_id = null;
  } else if (input.parentProjectId) {
    patch.parent_project_id = input.parentProjectId;

    if (input.normalizeClient !== false) {
      const { data: site } = await supabase
        .from("pm_projects")
        .select("client_id")
        .eq("id", input.parentProjectId)
        .maybeSingle();
      const siteClientId = (site as { client_id?: string | null } | null)?.client_id ?? null;
      if (siteClientId && siteClientId !== prev.client_id) {
        patch.client_id = siteClientId;
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", siteClientId)
          .maybeSingle();
        const ct = clientTag((client as { name?: string } | null)?.name);
        const nonClient = (prev.tags ?? []).filter((t) => !t.startsWith("client:"));
        patch.tags = ct ? [...nonClient, ct] : nonClient;
      }
    }
  }

  const project = await updateProject(input.requestId, patch as Partial<PmProject>);

  if (isCareer || wasCareer) {
    refreshCareerSiteProjects().catch(() => {});
  }

  const clientId = project.client_id ?? null;
  if (clientId) {
    await applyClientWatchers(project.id, clientId, nextType).catch(() => []);
  }

  emitTasksChanged();
  return project;
}

/** Pure: should unlinked list include this request? */
export function shouldShowInUnlinkedList(project: Pick<PmProject, "work_type" | "status" | "parent_project_id" | "custom_fields">): boolean {
  if (project.work_type !== "request") return false;
  if (project.status === "complete" || project.status === "archived") return false;
  if (project.parent_project_id) return false;
  return isCareerSiteRequest(project.custom_fields);
}

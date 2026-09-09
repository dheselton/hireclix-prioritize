/**
 * Multi-site career initiatives — umbrella project + one support request per site.
 */
import { supabase } from "@/integrations/supabase/client";
import { createProject } from "@/lib/pm/api";
import { createCareerSiteSupportRequest } from "@/lib/pm/supportQueue";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { todayISO } from "@/lib/pm/format";
import { isDone, type PmProject, type PmTask, type TaskStatus } from "@/types/pm";
import type { RequestType } from "@/lib/pm/requestTypes";
import type { CreationSource } from "@/lib/pm/attribution";

export type SiteInitiativeKind = "maintenance" | "feature";

export type SiteInitiativeMeta = {
  site_initiative: true;
  kind: SiteInitiativeKind;
};

export type CreateSiteInitiativeInput = {
  title: string;
  kind: SiteInitiativeKind;
  description?: string | null;
  dueDate?: string | null;
  ownerId?: string | null;
  createdBy?: string | null;
  /** Live career site project ids to roll out to. */
  siteProjectIds: string[];
  requestType?: RequestType;
  creationSource?: CreationSource;
};

export type SiteInitiativeItemRow = {
  id: string;
  initiative_project_id: string;
  site_project_id: string;
  request_project_id: string;
  sort_order: number;
  created_at: string;
};

export type SiteInitiativeRollupItem = {
  link: SiteInitiativeItemRow;
  site: Pick<PmProject, "id" | "title" | "client_id" | "status">;
  request: PmProject;
  openTasks: number;
  doneTasks: number;
  blockedTasks: number;
  rollupStatus: "needs_triage" | "in_progress" | "waiting" | "closed";
};

export type SiteInitiativeRollup = {
  initiative: PmProject;
  kind: SiteInitiativeKind;
  items: SiteInitiativeRollupItem[];
  totals: {
    sites: number;
    completed: number;
    inProgress: number;
    blocked: number;
    needsTriage: number;
  };
};

export function isSiteInitiativeProject(
  project: Pick<PmProject, "custom_fields"> | null | undefined,
): boolean {
  return !!(project?.custom_fields as SiteInitiativeMeta | null | undefined)?.site_initiative;
}

export function siteInitiativeKind(
  project: Pick<PmProject, "custom_fields"> | null | undefined,
): SiteInitiativeKind | null {
  const kind = (project?.custom_fields as SiteInitiativeMeta | null | undefined)?.kind;
  return kind === "maintenance" || kind === "feature" ? kind : null;
}

/** Create umbrella initiative + one careersite support request per selected site. */
export async function createSiteInitiative(
  input: CreateSiteInitiativeInput,
): Promise<{ initiative: PmProject; itemCount: number }> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  if (!input.siteProjectIds.length) throw new Error("Select at least one live site");

  const uniqueSiteIds = Array.from(new Set(input.siteProjectIds));
  const { data: sites, error: sitesErr } = await supabase
    .from("pm_projects")
    .select("id, title, client_id, custom_fields, work_type, status")
    .in("id", uniqueSiteIds);
  if (sitesErr) throw sitesErr;
  const siteRows = (sites ?? []) as unknown as PmProject[];
  if (siteRows.length !== uniqueSiteIds.length) {
    throw new Error("One or more selected sites could not be found");
  }

  const today = todayISO();
  const requestType: RequestType = input.requestType ?? (
    input.kind === "feature" ? "careersite_new_page" : "careersite_update"
  );
  const creationSource = input.creationSource ?? "manual";

  const initiative = await createProject({
    title,
    type: "dev",
    work_type: "project",
    status: "active",
    client_id: null,
    description: input.description?.trim() || null,
    start_date: today,
    go_live_date: input.dueDate ?? null,
    created_by: input.createdBy ?? null,
    requested_by: input.ownerId ?? input.createdBy ?? null,
    custom_fields: {
      site_initiative: true,
      kind: input.kind,
    } satisfies SiteInitiativeMeta,
    creation_source: creationSource,
    creation_context: {
      source: "site-initiative",
      kind: input.kind,
      site_count: siteRows.length,
    },
  } as Partial<PmProject> & { requested_by?: string | null; creation_source?: CreationSource });

  const linkRows: {
    initiative_project_id: string;
    site_project_id: string;
    request_project_id: string;
    sort_order: number;
  }[] = [];

  let sort = 0;
  for (const site of siteRows) {
    if (!site.client_id) {
      throw new Error(`Live site "${site.title}" has no client — assign a client before including it`);
    }
    const { project: request } = await createCareerSiteSupportRequest({
      title: `${title} — ${site.title}`,
      clientId: site.client_id,
      parentProjectId: site.id,
      requestType,
      description: input.description?.trim() || null,
      dueDate: input.dueDate ?? null,
      createdBy: input.createdBy ?? null,
      requestedBy: input.ownerId ?? input.createdBy ?? null,
      creationSource,
      creationContext: {
        source: "site-initiative-item",
        initiative_project_id: initiative.id,
        site_project_id: site.id,
        kind: input.kind,
      },
      customFields: {
        site_initiative_id: initiative.id,
      },
    });
    linkRows.push({
      initiative_project_id: initiative.id,
      site_project_id: site.id,
      request_project_id: request.id,
      sort_order: sort * 10,
    });
    sort += 1;
  }

  const { error: linkErr } = await supabase
    .from("pm_site_initiative_items")
    .insert(linkRows);
  if (linkErr) throw linkErr;

  emitTasksChanged();
  return { initiative, itemCount: linkRows.length };
}

async function fetchTasksForProjects(projectIds: string[]): Promise<PmTask[]> {
  if (!projectIds.length) return [];
  const { data, error } = await supabase
    .from("pm_tasks")
    .select("*")
    .in("project_id", projectIds);
  if (error) throw error;
  return (data ?? []) as unknown as PmTask[];
}

function itemRollupStatus(
  request: PmProject,
  tasks: PmTask[],
): SiteInitiativeRollupItem["rollupStatus"] {
  const inactive = request.status === "complete" || request.status === "archived";
  const open = tasks.filter((t) => !isDone(t.status as TaskStatus));
  if (inactive || (tasks.length > 0 && open.length === 0)) return "closed";
  if (request.status === "on_hold" || open.some((t) => t.status === "blocked")) return "waiting";
  if (open.some((t) => t.status === "unclaimed") || open.length === 0) return "needs_triage";
  return "in_progress";
}

export async function fetchSiteInitiativeRollup(
  initiativeProjectId: string,
): Promise<SiteInitiativeRollup | null> {
  const { data: initiative, error: initErr } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("id", initiativeProjectId)
    .maybeSingle();
  if (initErr) throw initErr;
  if (!initiative) return null;
  const initProj = initiative as unknown as PmProject;
  if (!isSiteInitiativeProject(initProj)) return null;

  const { data: links, error: linkErr } = await supabase
    .from("pm_site_initiative_items")
    .select("*")
    .eq("initiative_project_id", initiativeProjectId)
    .order("sort_order");
  if (linkErr) throw linkErr;
  const linkRows = (links ?? []) as unknown as SiteInitiativeItemRow[];

  if (!linkRows.length) {
    return {
      initiative: initProj,
      kind: siteInitiativeKind(initProj) ?? "maintenance",
      items: [],
      totals: { sites: 0, completed: 0, inProgress: 0, blocked: 0, needsTriage: 0 },
    };
  }

  const requestIds = linkRows.map((r) => r.request_project_id);
  const siteIds = linkRows.map((r) => r.site_project_id);

  const [{ data: requests }, { data: sites }, tasks] = await Promise.all([
    supabase.from("pm_projects").select("*").in("id", requestIds),
    supabase.from("pm_projects").select("id, title, client_id, status").in("id", siteIds),
    fetchTasksForProjects(requestIds),
  ]);

  const requestMap = new Map(
    ((requests ?? []) as unknown as PmProject[]).map((p) => [p.id, p]),
  );
  const siteMap = new Map(
    ((sites ?? []) as unknown as Pick<PmProject, "id" | "title" | "client_id" | "status">[]).map(
      (p) => [p.id, p],
    ),
  );
  const tasksByRequest = new Map<string, PmTask[]>();
  for (const t of tasks) {
    const list = tasksByRequest.get(t.project_id) ?? [];
    list.push(t);
    tasksByRequest.set(t.project_id, list);
  }

  const items: SiteInitiativeRollupItem[] = [];
  for (const link of linkRows) {
    const request = requestMap.get(link.request_project_id);
    const site = siteMap.get(link.site_project_id);
    if (!request || !site) continue;
    const reqTasks = tasksByRequest.get(request.id) ?? [];
    const open = reqTasks.filter((t) => !isDone(t.status as TaskStatus));
    const done = reqTasks.filter((t) => isDone(t.status as TaskStatus));
    const blocked = open.filter((t) => t.status === "blocked");
    items.push({
      link,
      site,
      request,
      openTasks: open.length,
      doneTasks: done.length,
      blockedTasks: blocked.length,
      rollupStatus: itemRollupStatus(request, reqTasks),
    });
  }

  const totals = {
    sites: items.length,
    completed: items.filter((i) => i.rollupStatus === "closed").length,
    inProgress: items.filter((i) => i.rollupStatus === "in_progress").length,
    blocked: items.filter((i) => i.rollupStatus === "waiting").length,
    needsTriage: items.filter((i) => i.rollupStatus === "needs_triage").length,
  };

  return {
    initiative: initProj,
    kind: siteInitiativeKind(initProj) ?? "maintenance",
    items,
    totals,
  };
}

export async function fetchOpenSiteInitiatives(): Promise<PmProject[]> {
  const { data, error } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("work_type", "project")
    .not("status", "in", '("complete","archived")')
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PmProject[]).filter(isSiteInitiativeProject);
}

/** Pure rollup helper for tests. */
export function summarizeInitiativeItems(
  statuses: SiteInitiativeRollupItem["rollupStatus"][],
): SiteInitiativeRollup["totals"] {
  return {
    sites: statuses.length,
    completed: statuses.filter((s) => s === "closed").length,
    inProgress: statuses.filter((s) => s === "in_progress").length,
    blocked: statuses.filter((s) => s === "waiting").length,
    needsTriage: statuses.filter((s) => s === "needs_triage").length,
  };
}

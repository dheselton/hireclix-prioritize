/**
 * Live Career Sites = projects in Support mode (post go-live inventory).
 * Career Site Support requests nest under them via parent_project_id.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject } from "@/types/pm";

export type LiveSiteSummary = Pick<
  PmProject,
  "id" | "title" | "client_id" | "go_live_date" | "status" | "type" | "work_type" | "custom_fields"
>;

/** True when a project row is a career-site *build* (not a support request). */
export function isCareerSiteBuildProject(
  project: Pick<PmProject, "type" | "work_type"> | null | undefined,
): boolean {
  if (!project) return false;
  if (project.work_type === "request") return false;
  return project.type === "career_site";
}

/** True when Support mode has been entered. */
export function isInSupportMode(
  project: Pick<PmProject, "custom_fields"> | null | undefined,
): boolean {
  return !!(project?.custom_fields as { support_mode_at?: string } | null | undefined)?.support_mode_at;
}

/** Inventory membership: Support-mode project that isn't complete/archived. */
export function isLiveCareerSite(
  project: Pick<PmProject, "work_type" | "status" | "custom_fields"> | null | undefined,
): boolean {
  if (!project) return false;
  if (project.work_type === "request") return false;
  if (project.status === "complete" || project.status === "archived") return false;
  return isInSupportMode(project);
}

/** Fetch Support-mode (live) sites for a client — used by intake site picker. */
export async function liveSitesForClient(clientId: string): Promise<LiveSiteSummary[]> {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("pm_projects")
    .select("id,title,client_id,go_live_date,status,type,work_type,custom_fields")
    .eq("client_id", clientId)
    .eq("work_type", "project")
    .not("status", "in", '("complete","archived")')
    .order("title");
  if (error) throw error;
  return ((data ?? []) as LiveSiteSummary[]).filter(isLiveCareerSite);
}

/** Resolve parent_project_id for a careersite_* intake. */
export function resolveParentProjectId(opts: {
  sites: LiveSiteSummary[];
  selectedId: string | null | undefined;
}): { parentProjectId: string | null; error?: string } {
  const { sites, selectedId } = opts;
  if (sites.length === 0) return { parentProjectId: null };
  if (sites.length === 1) return { parentProjectId: sites[0].id };
  if (!selectedId) return { parentProjectId: null, error: "Select which live career site this request belongs to" };
  if (!sites.some((s) => s.id === selectedId)) {
    return { parentProjectId: null, error: "Select a valid live career site" };
  }
  return { parentProjectId: selectedId };
}

/** Linked child request projects under a live site. */
export async function fetchLinkedSupportRequests(parentProjectId: string): Promise<PmProject[]> {
  const { data, error } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("parent_project_id", parentProjectId)
    .eq("work_type", "request")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PmProject[];
}

/** All live career sites across the workspace (for inventory page). */
export async function fetchLiveCareerSites(): Promise<LiveSiteSummary[]> {
  const { data, error } = await supabase
    .from("pm_projects")
    .select("id,title,client_id,go_live_date,status,type,work_type,custom_fields")
    .eq("work_type", "project")
    .not("status", "in", '("complete","archived")')
    .order("title");
  if (error) throw error;
  return ((data ?? []) as LiveSiteSummary[]).filter(isLiveCareerSite);
}

export function useLiveSitesForClient(clientId: string | null | undefined) {
  const [sites, setSites] = useState<LiveSiteSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!clientId) {
      setSites([]);
      return;
    }
    setLoading(true);
    try {
      setSites(await liveSitesForClient(clientId));
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useTasksChanged(reload);

  return { sites, loading, reload };
}

export async function linkRequestToLiveSite(requestProjectId: string, parentProjectId: string | null) {
  const { error } = await supabase
    .from("pm_projects")
    .update({ parent_project_id: parentProjectId })
    .eq("id", requestProjectId);
  if (error) throw error;
}

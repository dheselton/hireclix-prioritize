/**
 * Support-mode transition helpers.
 *
 * Career-site projects finish their build phase and are handed off to
 * ongoing support. Rather than relying on PMs to remember to flip the
 * "Enter Support mode" toggle, we auto-prompt them once the go-live date
 * arrives.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitTasksChanged, useTasksChanged } from "./refresh";
import { isCareerSiteBuildProject } from "./liveSites";
import { toast } from "sonner";
import type { PmProject } from "@/types/pm";

const DISMISS_KEY = "pm.supportPrompt.dismissed";
const DISMISS_DAYS = 7;

interface DismissMap { [projectId: string]: number /* epoch ms */ }

function loadDismissed(): DismissMap {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    // Prune expired entries opportunistically
    const now = Date.now();
    const cleaned: DismissMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && v > now) cleaned[k] = v;
    }
    return cleaned;
  } catch { return {}; }
}

function saveDismissed(map: DismissMap) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch {}
}

export function dismissSupportPrompt(projectId: string) {
  const map = loadDismissed();
  map[projectId] = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  saveDismissed(map);
}

export function clearSupportPromptDismissal(projectId: string) {
  const map = loadDismissed();
  delete map[projectId];
  saveDismissed(map);
}

function isDismissed(projectId: string): boolean {
  const map = loadDismissed();
  const until = map[projectId];
  return typeof until === "number" && until > Date.now();
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Pure predicate — is this career-site project ready for a support handoff? */
export function isReadyForSupport(
  project: Pick<PmProject, "id" | "go_live_date" | "custom_fields" | "type" | "work_type">,
  isCareerSiteBuild?: boolean,
): boolean {
  const isBuild = isCareerSiteBuild ?? isCareerSiteBuildProject(project);
  if (!isBuild) return false;
  const alreadyIn = !!(project.custom_fields as { support_mode_at?: string } | null)?.support_mode_at;
  if (alreadyIn) return false;
  if (!project.go_live_date) return false;
  return project.go_live_date <= todayIso();
}

/** Enter Support mode for a project — shared handler for banner + dropdown.
 *  Also clears QA mode so go-live testing ends when the site goes live. */
export function useEnterSupportMode(project: PmProject | null | undefined) {
  const [busy, setBusy] = useState(false);
  const enter = useCallback(async () => {
    if (!project) return;
    setBusy(true);
    try {
      const next = { ...(project.custom_fields ?? {}), support_mode_at: new Date().toISOString() };
      delete (next as { qa_mode_at?: string }).qa_mode_at;
      const { error } = await supabase
        .from("pm_projects")
        .update({ custom_fields: next })
        .eq("id", project.id);
      if (error) throw error;
      clearSupportPromptDismissal(project.id);
      toast.success("Project is now in Support mode");
      emitTasksChanged();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not enter Support mode";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [project]);
  return { enter, busy };
}

/** Should we show the auto-prompt banner right now? */
export function useShouldPromptSupport(project: PmProject | null | undefined): boolean {
  const [, force] = useState(0);
  // Recompute if the tasks-changed bus fires (project may have flipped elsewhere).
  useTasksChanged(() => force((n) => n + 1));
  if (!project) return false;
  if (isDismissed(project.id)) return false;
  return isReadyForSupport(project);
}

/** Career-site build projects across the workspace waiting for a Support handoff. */
export function useProjectsReadyForSupport(): PmProject[] {
  const [projects, setProjects] = useState<PmProject[]>([]);

  const reload = useCallback(async () => {
    const today = todayIso();
    const { data } = await supabase
      .from("pm_projects")
      .select("*")
      .eq("type", "career_site")
      .eq("work_type", "project")
      .lte("go_live_date", today)
      .not("status", "in", '("complete","archived")');
    const dismissed = loadDismissed();
    const filtered = ((data ?? []) as PmProject[]).filter((p) => {
      if ((p.custom_fields as { support_mode_at?: string } | null)?.support_mode_at) return false;
      if (dismissed[p.id] && dismissed[p.id] > Date.now()) return false;
      return true;
    });
    setProjects(filtered);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useTasksChanged(reload);
  return projects;
}

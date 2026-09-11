import { isDone } from "@/types/pm";
import type { PmTask, PmProject, TaskType } from "@/types/pm";
import type { ChipId } from "@/hooks/useChipFilters";
import type { WorkScope } from "@/hooks/useWorkScope";
import { isHardOverdue, isSlipped } from "@/lib/pm/dueState";
import { isInSupportMode } from "@/lib/pm/liveSites";
import { todayISO } from "@/lib/pm/format";

/** Project statuses that are retired from current-work views. */
export const RETIRED_PROJECT_STATUSES = new Set(["complete", "archived", "cancelled"]);

export function isRetiredProject(
  project: Pick<PmProject, "status"> | null | undefined,
): boolean {
  if (!project) return false;
  return RETIRED_PROJECT_STATUSES.has(project.status);
}

/** Hours a just-completed task stays visible under Open scope (kanban grace). */
export const RECENTLY_DONE_WINDOW_HOURS = 6;

export function isRecentlyDone(task: PmTask, now: Date = new Date()): boolean {
  if (!isDone(task.status)) return false;
  const at = task.status_changed_at ?? task.updated_at;
  if (!at) return false;
  const ts = new Date(at).getTime();
  if (Number.isNaN(ts)) return false;
  const windowMs = RECENTLY_DONE_WINDOW_HOURS * 60 * 60 * 1000;
  return now.getTime() - ts <= windowMs;
}

/** Hours left before a done task drops out of Open scope; null if not applicable. */
export function recentlyDoneHoursLeft(task: PmTask, now: Date = new Date()): number | null {
  if (!isRecentlyDone(task, now)) return null;
  const at = task.status_changed_at ?? task.updated_at;
  const elapsedMs = now.getTime() - new Date(at!).getTime();
  return Math.max(0, RECENTLY_DONE_WINDOW_HOURS - elapsedMs / 3_600_000);
}

/**
 * Scope filter for current-work surfaces.
 * - open: hide done (except last 6h) and tasks on retired projects
 * - completed: only done tasks
 * - all: unfiltered
 */
export function applyWorkScope(
  tasks: PmTask[],
  scope: WorkScope,
  projById: Map<string, PmProject>,
  now: Date = new Date(),
): PmTask[] {
  if (scope === "all") return tasks;
  if (scope === "completed") {
    return tasks.filter(t => isDone(t.status));
  }
  // open
  return tasks.filter(t => {
    const project = projById.get(t.project_id);
    if (isRetiredProject(project)) return false;
    if (isDone(t.status)) return isRecentlyDone(t, now);
    return true;
  });
}

/** Filter tasks by a type allow-list. Empty set = no filter (show all). */
export function applyTaskTypes(tasks: PmTask[], types: Set<TaskType>): PmTask[] {
  if (!types || types.size === 0) return tasks;
  return tasks.filter(t => types.has(t.type));
}

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfWeek = () => { const d = startOfToday(); d.setDate(d.getDate() + 7); return d; };

export function applyTaskMeMode(
  tasks: PmTask[],
  isMe: boolean,
  meId: string | null | undefined,
  coAssignedTaskIds?: Set<string>,
) {
  if (!isMe || !meId) return tasks;
  return tasks.filter(t => t.assignee_id === meId || coAssignedTaskIds?.has(t.id));
}

export function applyTaskChips(
  tasks: PmTask[],
  active: Set<ChipId>,
  meId: string | null | undefined,
  watcherTaskIds?: Set<string>,
  coAssignedTaskIds?: Set<string>,
  vendorBlockedTaskIds?: Set<string>,
) {
  if (!active.size) return tasks;
  const today = startOfToday();
  const week = endOfWeek();
  const todayKey = todayISO();
  const isMine = (t: PmTask) => !!meId && (t.assignee_id === meId || coAssignedTaskIds?.has(t.id));
  return tasks.filter(t => {
    for (const id of active) {
      switch (id) {
        case "assigned_to_me":
          if (!isMine(t)) return false; break;
        case "created_by_me":
          if (!meId || t.created_by !== meId) return false; break;
        case "watching": {
          if (!watcherTaskIds) return false;
          if (!watcherTaskIds.has(t.id)) return false;
          break;
        }
        case "overdue":
          if (!isHardOverdue(t, todayKey)) return false;
          break;
        case "slipped":
          if (!isSlipped(t, todayKey)) return false;
          break;
        case "due_this_week": {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          if (d < today || d > week) return false;
          break;
        }
        case "blocked":
          if (t.status !== "blocked") return false; break;
        case "unclaimed":
          if (t.status !== "unclaimed") return false; break;
        case "waiting_on_vendor":
          if (!vendorBlockedTaskIds?.has(t.id)) return false;
          break;
      }
    }
    return true;
  });
}

export function applyProjectMeMode(
  projects: PmProject[],
  isMe: boolean,
  meId: string | null | undefined,
  memberProjectIds?: Set<string>,
) {
  if (!isMe || !meId) return projects;
  return projects.filter(p =>
    p.created_by === meId || (memberProjectIds ? memberProjectIds.has(p.id) : false)
  );
}

/** Filter projects by milestone keys. Empty = no filter. Use `__unset__` for null milestone. */
export function applyProjectMilestones(
  projects: PmProject[],
  milestoneKeys: string[],
  unsetKey = "__unset__",
): PmProject[] {
  if (!milestoneKeys.length) return projects;
  const set = new Set(milestoneKeys);
  return projects.filter((p) => {
    if (!p.milestone) return set.has(unsetKey);
    return set.has(p.milestone);
  });
}

export function applyProjectChips(
  projects: PmProject[],
  tasks: PmTask[],
  active: Set<ChipId>,
  meId: string | null | undefined,
  memberProjectIds?: Set<string>,
) {
  if (!active.size) return projects;
  const today = startOfToday();
  const week = endOfWeek();
  const blockedByProj = new Set(tasks.filter(t => t.status === "blocked").map(t => t.project_id));
  return projects.filter(p => {
    for (const id of active) {
      switch (id) {
        case "assigned_to_me":
          if (!meId || !memberProjectIds?.has(p.id)) return false; break;
        case "created_by_me":
          if (!meId || p.created_by !== meId) return false; break;
        case "watching":
          // Members are watching by default; explicit watchers are member rows too.
          if (!meId || !memberProjectIds?.has(p.id)) return false; break;
        case "overdue":
          if (!p.go_live_date) return false;
          if (new Date(p.go_live_date) >= today) return false;
          if (p.status === "complete") return false;
          // A live site's go-live date is a launch milestone, not a missed deadline.
          if (isInSupportMode(p)) return false;
          break;
        case "due_this_week": {
          if (!p.go_live_date) return false;
          const d = new Date(p.go_live_date);
          if (d < today || d > week) return false;
          break;
        }
        case "blocked":
          if (!blockedByProj.has(p.id)) return false; break;
      }
    }
    return true;
  });
}

// ── Workload diagnosis filters ───────────────────────────────────────────────
/** State filters used by the Workload person-card chips (`/pm/work?filter=`). */
export type WorkStateFilter = "overdue" | "due-this-week" | "blocked" | "no-date";

export const WORK_STATE_FILTERS: WorkStateFilter[] = ["overdue", "due-this-week", "blocked", "no-date"];

export const WORK_STATE_LABEL: Record<WorkStateFilter, string> = {
  overdue: "Overdue",
  "due-this-week": "Due this week",
  blocked: "Blocked",
  "no-date": "No date",
};

export const isWorkStateFilter = (v: unknown): v is WorkStateFilter =>
  typeof v === "string" && (WORK_STATE_FILTERS as string[]).includes(v);

/** Does an (already active/open) task match the given state filter? */
export function matchesWorkState(t: PmTask, filter: WorkStateFilter): boolean {
  if (isDone(t.status)) return false;
  const today = startOfToday();
  const week = endOfWeek();
  switch (filter) {
    case "overdue":
      return isHardOverdue(t);
    case "due-this-week": {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= today && d <= week;
    }
    case "blocked":
      return t.status === "blocked";
    case "no-date":
      return !t.due_date;
  }
}

/**
 * Dependency-driven task visibility.
 *
 * `reveal_mode` on `pm_task_dependencies` controls when a downstream task
 * surfaces in default task lists. It does NOT affect the scheduler, the Gantt,
 * or time tracking — those always operate on the full task set.
 *
 *  - `on_complete` (default): downstream is hidden until predecessor reaches
 *                              `approved` or `complete`.
 *  - `on_start`:               downstream is hidden until predecessor reaches
 *                              `in_progress`/`in_review`/`approved`/`complete`.
 *  - `always`:                 downstream is always visible (parallel work).
 *
 * A task is "hidden" only if it has at least one dependency that says so —
 * tasks with no deps are always visible (preserves existing behavior).
 */

import { TERMINAL_STATUSES, type PmTask, type PmDependency, type TaskStatus, type RevealMode } from "@/types/pm";

const STARTED_STATES: TaskStatus[] = ["in_progress", "in_review", "approved", "complete"];

function predecessorSatisfies(predStatus: TaskStatus | undefined | null, mode: RevealMode): boolean {
  if (!predStatus) return true;
  if (mode === "always") return true;
  if (mode === "on_start") return STARTED_STATES.includes(predStatus);
  return TERMINAL_STATUSES.includes(predStatus); // on_complete
}

/** Returns the set of task ids that should be hidden by default. */
export function computeHiddenTaskIds(tasks: PmTask[], deps: PmDependency[]): Set<string> {
  const statusById = new Map<string, TaskStatus>();
  for (const t of tasks) statusById.set(t.id, t.status as TaskStatus);

  const hidden = new Set<string>();
  for (const d of deps) {
    const mode = (d.reveal_mode ?? "on_complete") as RevealMode;
    if (mode === "always") continue;
    const predStatus = statusById.get(d.depends_on_task_id);
    if (!predecessorSatisfies(predStatus, mode)) hidden.add(d.task_id);
  }
  return hidden;
}

/** Convenience: per-task check. */
export function isTaskHidden(task: PmTask, tasks: PmTask[], deps: PmDependency[]): boolean {
  return computeHiddenTaskIds(tasks, deps).has(task.id);
}

/** Returns the first unmet predecessor task for a hidden task (for UI hint). */
export function firstUnmetPredecessor(
  taskId: string,
  tasks: PmTask[],
  deps: PmDependency[],
): { predecessor: PmTask; mode: RevealMode } | null {
  const byId = new Map(tasks.map(t => [t.id, t]));
  for (const d of deps) {
    if (d.task_id !== taskId) continue;
    const mode = (d.reveal_mode ?? "on_complete") as RevealMode;
    if (mode === "always") continue;
    const pred = byId.get(d.depends_on_task_id);
    if (!pred) continue;
    if (!predecessorSatisfies(pred.status as TaskStatus, mode)) {
      return { predecessor: pred, mode };
    }
  }
  return null;
}

export const REVEAL_MODE_LABEL: Record<RevealMode, string> = {
  on_complete: "Reveal when prerequisite is complete",
  on_start: "Reveal when prerequisite starts",
  always: "Always visible (parallel)",
};

export const REVEAL_MODE_SHORT: Record<RevealMode, string> = {
  on_complete: "On complete",
  on_start: "On start",
  always: "Always",
};

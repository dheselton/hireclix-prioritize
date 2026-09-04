/**
 * Status-aware due-date state — single source of truth for overdue vs slipped.
 *
 * - overdue: past due + unclaimed/claimed (unowned / not started) — hard miss
 * - slipped: past due + in_progress/in_review/blocked — soft, often pushed
 * - settled: terminal status — never treat as overdue
 * - today / upcoming / none: date-only buckets when not past due
 */
import { todayISO } from "@/lib/pm/format";
import { isDone, type TaskStatus } from "@/types/pm";

export type DueState =
  | "overdue"
  | "slipped"
  | "settled"
  | "today"
  | "upcoming"
  | "none";

/** Statuses that count as a hard miss when past due. */
export const HARD_OVERDUE_STATUSES: TaskStatus[] = ["unclaimed", "claimed"];

/** Statuses that count as soft/slipped when past due. */
export const SLIPPED_STATUSES: TaskStatus[] = ["in_progress", "in_review", "blocked"];

export type DueStateInput = {
  due_date?: string | null;
  status?: TaskStatus | string | null;
};

export function dueState(
  task: DueStateInput,
  today = todayISO(),
): DueState {
  const due = task.due_date ?? null;
  if (!due) return "none";

  const status = (task.status ?? null) as TaskStatus | null;
  if (status && isDone(status)) return "settled";

  if (due < today) {
    if (status && HARD_OVERDUE_STATUSES.includes(status)) return "overdue";
    if (status && SLIPPED_STATUSES.includes(status)) return "slipped";
    // Unknown / missing status with past due → treat as hard overdue
    return "overdue";
  }
  if (due === today) return "today";
  return "upcoming";
}

/** Calendar days past due (0 if not past due / no date). */
export function daysLate(dueDate: string | null | undefined, today = todayISO()): number {
  if (!dueDate || dueDate >= today) return 0;
  const a = new Date(`${dueDate}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export function isHardOverdue(task: DueStateInput, today = todayISO()): boolean {
  return dueState(task, today) === "overdue";
}

export function isSlipped(task: DueStateInput, today = todayISO()): boolean {
  return dueState(task, today) === "slipped";
}

/** Left-border accent only for hard overdue (not slipped). */
export function dueAccentClass(task: DueStateInput, today = todayISO()): string {
  return dueState(task, today) === "overdue" ? "border-l-[3px] border-l-destructive" : "";
}

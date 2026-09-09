/**
 * Status-clock labels for waiting work — days since current status was entered.
 */
import { fmtDateShort, localDateISO, todayISO } from "@/lib/pm/format";
import { dueState, SLIPPED_STATUSES, type DueState } from "@/lib/pm/dueState";
import type { ProjectStatus, TaskStatus } from "@/types/pm";

const TASK_STATUS_LABELS: Partial<Record<TaskStatus, string>> = {
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
};

const PROJECT_WAITING_LABELS: Partial<Record<ProjectStatus, string>> = {
  on_hold: "On hold",
  in_review: "In review",
};

export type StatusClockMeta = {
  primary: string;
  secondary: string | null;
  className: string;
  /** Days since status was entered — for sorting. */
  statusDays: number;
};

export function daysSince(
  isoTimestamp: string | null | undefined,
  today = todayISO(),
): number {
  if (!isoTimestamp) return 0;
  const dateKey = localDateISO(new Date(isoTimestamp));
  if (dateKey >= today) return 0;
  const a = new Date(`${dateKey}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function statusLabel(status: string): string | null {
  return (
    TASK_STATUS_LABELS[status as TaskStatus] ??
    PROJECT_WAITING_LABELS[status as ProjectStatus] ??
    null
  );
}

function dueSecondary(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null;
  return `Due ${fmtDateShort(dueDate)}`;
}

/** Resolve status clock timestamp; falls back to updated_at. */
export function resolveStatusChangedAt(
  statusChangedAt: string | null | undefined,
  updatedAt?: string | null,
): string | null {
  return statusChangedAt ?? updatedAt ?? null;
}

type TaskClockInput = {
  due_date?: string | null;
  status?: TaskStatus | string | null;
  status_changed_at?: string | null;
  updated_at?: string | null;
};

type ProjectClockInput = {
  dueDate?: string | null;
  status?: ProjectStatus | string | null;
  status_changed_at?: string | null;
  updated_at?: string | null;
};

/** Status-clock badge meta for slipped task statuses. */
export function taskStatusClockMeta(
  task: TaskClockInput,
  today = todayISO(),
): StatusClockMeta | null {
  const status = task.status as TaskStatus | null;
  if (!status || !SLIPPED_STATUSES.includes(status)) return null;

  const state = dueState({ due_date: task.due_date, status }, today);
  if (state !== "slipped") return null;

  const label = statusLabel(status);
  if (!label) return null;

  const at = resolveStatusChangedAt(task.status_changed_at, task.updated_at);
  const statusDays = daysSince(at, today);

  return {
    primary: `${label} · ${statusDays}d`,
    secondary: dueSecondary(task.due_date),
    className: "text-amber-700 dark:text-amber-300 font-medium",
    statusDays,
  };
}

/** Status-clock for projects waiting on client / review. */
export function projectStatusClockMeta(
  project: ProjectClockInput,
  today = todayISO(),
): StatusClockMeta | null {
  const status = project.status as ProjectStatus | null;
  if (!status) return null;

  const label = PROJECT_WAITING_LABELS[status];
  if (!label) return null;

  const at = resolveStatusChangedAt(project.status_changed_at, project.updated_at);
  const statusDays = daysSince(at, today);

  return {
    primary: `${label} · ${statusDays}d`,
    secondary: dueSecondary(project.dueDate),
    className: "text-amber-700 dark:text-amber-300 font-medium",
    statusDays,
  };
}

/** Sort key: urgency bucket, then status age (longest wait first) within slipped. */
export function waitingSortKey(
  input: {
    dueDate?: string | null;
    status?: string | null;
    statusChangedAt?: string | null;
    updatedAt?: string | null;
  },
  today = todayISO(),
): number {
  const state: DueState = input.status != null
    ? dueState({ due_date: input.dueDate, status: input.status }, today)
    : "none";

  let bucket = 4;
  if (state === "overdue") bucket = 0;
  else if (state === "slipped") bucket = 1;
  else if (state === "today") bucket = 2;
  else if (state === "upcoming") bucket = 3;

  const statusDays = state === "slipped"
    ? daysSince(resolveStatusChangedAt(input.statusChangedAt, input.updatedAt), today)
    : 0;

  // Lower = more urgent. Within slipped, longer status wait sorts first (negate days).
  return bucket * 100000 - statusDays;
}

/** Notification body for slipped / waiting work. */
export function slippedNotificationBody(
  task: TaskClockInput & { title?: string },
  today = todayISO(),
): string {
  const status = task.status as TaskStatus | null;
  const label = status ? statusLabel(status) : null;
  const at = resolveStatusChangedAt(task.status_changed_at, task.updated_at);
  const statusDays = daysSince(at, today);
  const duePart = task.due_date
    ? `; original due ${fmtDateShort(task.due_date)}`
    : "";

  if (label && at) {
    const since = fmtDateShort(localDateISO(new Date(at)));
    return `${label} since ${since} — ${statusDays} day${statusDays === 1 ? "" : "s"}${duePart}`;
  }

  if (task.due_date) {
    return `Due ${fmtDateShort(task.due_date)} — no updates in 3+ days`;
  }
  return "No updates in 3+ days";
}

/**
 * Due-date urgency helpers + DueBadge for scannable task cards.
 *
 * Pass `status` for tasks so past-due work can render as overdue (hard) vs
 * slipped (soft). Without status, date-only classification is used (notes).
 */
import { Calendar } from "lucide-react";
import { fmtDate, todayISO } from "@/lib/pm/format";
import { daysLate, dueState, type DueState } from "@/lib/pm/dueState";
import type { TaskStatus } from "@/types/pm";
import { cn } from "@/lib/utils";

/** Date-only urgency (notes / non-task entities). Prefer dueState for tasks. */
export type DueUrgency = "overdue" | "today" | "upcoming" | "none";

export function dueUrgency(dueDate: string | null | undefined, today = todayISO()): DueUrgency {
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

/** @deprecated Prefer dueAccentClass from @/lib/pm/dueState with status. */
export function overdueAccentClass(dueDate: string | null | undefined): string {
  return dueUrgency(dueDate) === "overdue" ? "border-l-[3px] border-l-destructive" : "";
}

type DueBadgeSize = "sm" | "md";

/**
 * Scannable due-date badge: Overdue / Past due / Today / formatted date / No date.
 */
export function DueBadge({
  dueDate,
  status,
  dueDateChanges,
  size = "sm",
  showEmpty = true,
  className,
}: {
  dueDate: string | null | undefined;
  /** When provided, past-due work uses status-aware overdue vs slipped. */
  status?: TaskStatus | string | null;
  /** Optional push count from pm_tasks.due_date_changes. */
  dueDateChanges?: number | null;
  size?: DueBadgeSize;
  /** When false, render nothing if there is no due date. */
  showEmpty?: boolean;
  className?: string;
}) {
  const state: DueState =
    status != null
      ? dueState({ due_date: dueDate, status })
      : (dueUrgency(dueDate) as DueState);

  if (state === "none" && !showEmpty) return null;

  const text = size === "md" ? "text-xs" : "text-[11px]";
  const pad = size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5";
  const late = daysLate(dueDate);
  const pushed = dueDateChanges && dueDateChanges > 0 ? ` · pushed ${dueDateChanges}x` : "";

  if (state === "overdue") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded font-semibold tabular-nums text-destructive bg-destructive/10",
          text,
          pad,
          className,
        )}
      >
        <Calendar className="h-3 w-3 shrink-0" />
        Overdue{dueDate ? ` · ${fmtDate(dueDate)}` : ""}{pushed}
      </span>
    );
  }
  if (state === "slipped") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded font-medium tabular-nums text-amber-700 bg-amber-500/15 dark:text-amber-300",
          text,
          pad,
          className,
        )}
      >
        <Calendar className="h-3 w-3 shrink-0" />
        Past due{late > 0 ? ` · ${late}d` : dueDate ? ` · ${fmtDate(dueDate)}` : ""}{pushed}
      </span>
    );
  }
  if (state === "settled" && dueDate) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded font-medium tabular-nums text-muted-foreground bg-muted/40",
          text,
          pad,
          className,
        )}
      >
        <Calendar className="h-3 w-3 shrink-0" />
        {fmtDate(dueDate)}
      </span>
    );
  }
  if (state === "today") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded font-semibold tabular-nums text-amber-700 bg-amber-500/15 dark:text-amber-300",
          text,
          pad,
          className,
        )}
      >
        <Calendar className="h-3 w-3 shrink-0" />
        Today
      </span>
    );
  }
  if (state === "upcoming" && dueDate) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded font-medium tabular-nums text-foreground/80 bg-muted/60",
          text,
          pad,
          className,
        )}
      >
        <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
        {fmtDate(dueDate)}
      </span>
    );
  }
  if (state === "settled") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", text, className)}>
        No date
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-muted-foreground", text, className)}>
      No date
    </span>
  );
}

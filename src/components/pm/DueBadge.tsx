/**
 * Due-date urgency helpers + DueBadge for scannable task cards.
 */
import { Calendar } from "lucide-react";
import { fmtDate, todayISO } from "@/lib/pm/format";
import { cn } from "@/lib/utils";

export type DueUrgency = "overdue" | "today" | "upcoming" | "none";

export function dueUrgency(dueDate: string | null | undefined, today = todayISO()): DueUrgency {
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

export function overdueAccentClass(dueDate: string | null | undefined): string {
  return dueUrgency(dueDate) === "overdue" ? "border-l-[3px] border-l-destructive" : "";
}

type DueBadgeSize = "sm" | "md";

/**
 * Scannable due-date badge: Overdue / Today / formatted date / No date.
 */
export function DueBadge({
  dueDate,
  size = "sm",
  showEmpty = true,
  className,
}: {
  dueDate: string | null | undefined;
  size?: DueBadgeSize;
  /** When false, render nothing if there is no due date. */
  showEmpty?: boolean;
  className?: string;
}) {
  const u = dueUrgency(dueDate);
  if (u === "none" && !showEmpty) return null;

  const text =
    size === "md" ? "text-xs" : "text-[11px]";
  const pad = size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5";

  if (u === "overdue") {
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
        Overdue{dueDate ? ` · ${fmtDate(dueDate)}` : ""}
      </span>
    );
  }
  if (u === "today") {
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
  if (u === "upcoming" && dueDate) {
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
  return (
    <span className={cn("inline-flex items-center gap-1 text-muted-foreground", text, className)}>
      No date
    </span>
  );
}

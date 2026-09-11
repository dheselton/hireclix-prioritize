import { cn } from "@/lib/utils";
import {
  RECENTLY_DONE_WINDOW_HOURS,
  recentlyDoneHoursLeft,
} from "@/lib/pm/filters";
import type { PmTask } from "@/types/pm";

/**
 * Shows how long until a just-completed task drops out of Open scope.
 * Renders nothing when the task is not inside the grace window.
 */
export function RecentlyDoneBadge({
  task,
  className,
}: {
  task: Pick<PmTask, "status" | "status_changed_at" | "updated_at">;
  className?: string;
}) {
  const hoursLeft = recentlyDoneHoursLeft(task as PmTask);
  if (hoursLeft == null) return null;

  const label =
    hoursLeft < 1
      ? "Clears in <1h"
      : `Clears in ${Math.ceil(hoursLeft)}h`;

  return (
    <span
      title={`Completed work stays in Open view for ${RECENTLY_DONE_WINDOW_HOURS} hours`}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        "text-muted-foreground bg-muted/40",
        className,
      )}
    >
      {label}
    </span>
  );
}

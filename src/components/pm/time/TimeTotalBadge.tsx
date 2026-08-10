import { Clock } from "lucide-react";
import { fmtDur } from "@/lib/pm/time";
import { useTaskTimeTotal } from "@/lib/pm/taskTime";
import { cn } from "@/lib/utils";

/**
 * Compact "total time tracked" badge for task cards/rows.
 * Renders nothing when no time has been logged so clean cards stay clean.
 */
export function TimeTotalBadge({
  taskId,
  className,
  size = "xs",
}: {
  taskId: string;
  className?: string;
  size?: "xs" | "sm";
}) {
  const minutes = useTaskTimeTotal(taskId);
  if (!minutes) return null;
  return (
    <span
      title={`${fmtDur(minutes)} tracked`}
      className={cn(
        "inline-flex items-center gap-1 text-muted-foreground shrink-0",
        size === "xs" ? "text-[10px]" : "text-[11px]",
        className,
      )}
    >
      <Clock className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {fmtDur(minutes)}
    </span>
  );
}

import { useActiveTimer, formatHMS } from "@/components/pm/timer/ActiveTimerProvider";
import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function TimerPill({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { current, elapsedMs, start, stop, isRunning } = useActiveTimer();
  const running = isRunning(taskId);
  const otherRunning = !!current && !running;

  if (running) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border pl-3 pr-1 py-1 shadow-sm">
        <span className="tabular-nums text-base font-semibold text-foreground">
          {formatHMS(elapsedMs)}
        </span>
        <button
          type="button"
          aria-label="Stop timer"
          onClick={() => stop()}
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-full",
            "bg-destructive text-destructive-foreground hover:opacity-90 transition"
          )}
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => start(taskId, taskTitle)}
      title={otherRunning ? `Will stop "${current?.taskTitle}"` : "Start timer"}
      className="inline-flex items-center gap-2 rounded-full bg-card border border-border pl-3 pr-1 py-1 shadow-sm hover:border-primary/60 transition"
    >
      <span className="font-mono tabular-nums text-base font-semibold text-muted-foreground">
        00:00:00
      </span>
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground">
        <Play className="h-3 w-3 fill-current" />
      </span>
    </button>
  );
}

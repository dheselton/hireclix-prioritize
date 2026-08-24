import { useMemo, useState } from "react";
import { Clock, Play, Square, Timer } from "lucide-react";
import { useActiveTimer, formatHMS } from "@/components/pm/timer/ActiveTimerProvider";
import { cn } from "@/lib/utils";
import { TimeLogDialog } from "./TimeLogDialog";
import { useTaskTimeTotal } from "@/lib/pm/taskTime";
import { entryEndTime, fmtDur, fmtLastTracked, useEnrichedEntries } from "@/lib/pm/time";

export function TimerPill({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { current, elapsedMs, start, stop, isRunning } = useActiveTimer();
  const running = isRunning(taskId);
  const otherRunning = !!current && !running;
  const [logOpen, setLogOpen] = useState(false);
  const totalMinutes = useTaskTimeTotal(taskId);
  const { entries } = useEnrichedEntries({ taskId }, [taskId]);

  const lastTracked = useMemo(() => {
    let latest: Date | null = null;
    for (const e of entries) {
      const end = entryEndTime(e);
      if (end && (!latest || end > latest)) latest = end;
    }
    return latest;
  }, [entries]);

  const trackedTitle = lastTracked
    ? `Last tracked: ${fmtLastTracked(lastTracked)}`
    : "View tracked time";

  return (
    <>
      <div className="inline-flex items-center gap-2">
        {running ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border pl-2.5 pr-0.5 py-0.5 shadow-sm">
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {formatHMS(elapsedMs)}
            </span>
            <button
              type="button"
              aria-label="Stop timer"
              onClick={() => stop()}
              className={cn(
                "inline-flex items-center justify-center h-6 w-6 rounded-full",
                "bg-destructive text-destructive-foreground hover:opacity-90 transition"
              )}
            >
              <Square className="h-2.5 w-2.5 fill-current" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => start(taskId, taskTitle)}
            title={otherRunning ? `Will stop "${current?.taskTitle}"` : "Start timer"}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground hover:border-primary/60 transition"
          >
            <Timer className="h-3.5 w-3.5" />
            Track time
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground">
              <Play className="h-2.5 w-2.5 fill-current" />
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setLogOpen(true)}
          title={trackedTitle}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm hover:bg-muted/70 transition"
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Tracked</span>
          <span className="font-medium tabular-nums text-foreground">{fmtDur(totalMinutes)}</span>
        </button>
      </div>

      <TimeLogDialog
        taskId={taskId}
        open={logOpen}
        onOpenChange={setLogOpen}
        lastTracked={lastTracked}
      />
    </>
  );
}

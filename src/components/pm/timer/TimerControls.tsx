import { useActiveTimer, formatHMS } from "./ActiveTimerProvider";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

export function TimerControls({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { current, elapsedMs, start, stop, isRunning } = useActiveTimer();
  const running = isRunning(taskId);
  const otherRunning = !!current && !running;

  if (running) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-sm font-mono tabular-nums text-primary px-2 py-1 rounded bg-primary/10">
          {formatHMS(elapsedMs)}
        </div>
        <Button size="sm" variant="destructive" onClick={() => stop()}>
          <Square className="h-3 w-3 mr-1 fill-current" /> Stop
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => start(taskId, taskTitle)} title={otherRunning ? `Will stop "${current?.taskTitle}"` : ""}>
      <Play className="h-3 w-3 mr-1" /> Start timer
    </Button>
  );
}

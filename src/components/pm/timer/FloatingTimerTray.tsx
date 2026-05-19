import { useLocation, useNavigate } from "react-router-dom";
import { useActiveTimer, formatHMS } from "./ActiveTimerProvider";
import { Button } from "@/components/ui/button";
import { Square, Clock } from "lucide-react";

export function FloatingTimerTray() {
  const { current, elapsedMs, stop } = useActiveTimer();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!current) return null;

  // The TaskWorkspace renders its own TimerPill — don't double up.
  if (pathname === `/pm/tasks/${current.taskId}`) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 shadow-lg border border-border bg-card rounded-lg px-3 py-2 flex items-center gap-3 min-w-[280px]">
      <button
        onClick={() => navigate(`/pm/tasks/${current.taskId}`)}
        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80"
      >
        <Clock className="h-4 w-4 text-primary animate-pulse shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{current.taskTitle}</div>
          <div className="text-sm font-mono tabular-nums">{formatHMS(elapsedMs)}</div>
        </div>
      </button>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => stop()}>
        <Square className="h-4 w-4 fill-current" />
      </Button>
    </div>
  );
}

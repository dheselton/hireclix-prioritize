import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useActiveTimer, formatHMS } from "./ActiveTimerProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Square, Clock, Activity } from "lucide-react";

export function FloatingTimerTray() {
  const { current, elapsedMs, stop } = useActiveTimer();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [note, setNote] = useState("");

  // Reset note when timer target changes
  useEffect(() => {
    setNote("");
  }, [current?.taskId, current?.activityId]);

  if (!current) return null;
  if (current.taskId && pathname === `/pm/tasks/${current.taskId}`) return null;

  const isActivity = !!current.activityId;
  const href = isActivity ? "/pm/time" : `/pm/tasks/${current.taskId}`;

  async function handleStop() {
    await stop(note);
    setNote("");
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 shadow-lg border border-border bg-card rounded-lg px-3 py-2 flex items-center gap-3 sm:min-w-[280px] sm:max-w-[calc(100vw-2rem)] safe-bottom">
      <button
        onClick={() => navigate(href)}
        className="flex items-center gap-2 min-w-0 text-left hover:opacity-80"
      >
        {isActivity
          ? <Activity className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
          : <Clock className="h-4 w-4 text-primary animate-pulse shrink-0" />}
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">
            {isActivity && <span className="text-[10px] uppercase tracking-wide text-amber-600 mr-1">Activity ·</span>}
            {current.taskTitle}
          </div>
          <div className="text-sm tabular-nums">{formatHMS(elapsedMs)}</div>
        </div>
      </button>
      {isActivity && (
        <Input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What are you working on?"
          className="h-8 flex-1 min-w-[140px] text-xs"
        />
      )}
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleStop}>
        <Square className="h-4 w-4 fill-current" />
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useActiveTimer,
  formatHMS,
  formatHM,
  TIMER_SOFT_WARN_MS,
  TIMER_REWARN_INTERVAL_MS,
} from "./ActiveTimerProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Square, Clock, Activity, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function FloatingTimerTray() {
  const { current, elapsedMs, stop, stopWithMinutes } = useActiveTimer();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [note, setNote] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState<number>(0);

  // Reset note + snooze when timer target changes
  useEffect(() => {
    setNote("");
    setSnoozeUntil(0);
  }, [current?.taskId, current?.activityId, current?.startedAt]);

  if (!current) return null;
  if (current.taskId && pathname === `/pm/tasks/${current.taskId}`) return null;

  const isActivity = !!current.activityId;
  const href = isActivity ? "/pm/time" : `/pm/tasks/${current.taskId}`;
  const showLongWarn = elapsedMs >= TIMER_SOFT_WARN_MS && Date.now() >= snoozeUntil;

  async function handleStop() {
    await stop(note);
    setNote("");
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 space-y-2 sm:min-w-[280px] sm:max-w-[calc(100vw-2rem)] safe-bottom">
      {showLongWarn && (
        <LongRunWarning
          elapsedMs={elapsedMs}
          onKeep={() => setSnoozeUntil(Date.now() + TIMER_REWARN_INTERVAL_MS)}
          onStop={handleStop}
          onAdjust={async (mins) => { await stopWithMinutes(mins, note); setNote(""); }}
        />
      )}
      <div className="shadow-lg border border-border bg-card rounded-lg px-3 py-2 flex items-center gap-3">
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
    </div>
  );
}

function LongRunWarning({
  elapsedMs, onKeep, onStop, onAdjust,
}: {
  elapsedMs: number;
  onKeep: () => void;
  onStop: () => void | Promise<void>;
  onAdjust: (minutes: number) => Promise<void>;
}) {
  const total = Math.round(elapsedMs / 60000);
  const [h, setH] = useState(String(Math.floor(total / 60)));
  const [m, setM] = useState(String(total % 60));

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 shadow-lg px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Timer has been running for {formatHM(elapsedMs)}. Still working?
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onKeep}>
              Keep Running
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStop()}>
              Stop &amp; Log
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" className="h-7 text-xs">Adjust Time</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 z-50 bg-popover space-y-2">
                <div className="text-xs font-medium">Log actual duration</div>
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="text-[10px]">Hours</Label>
                    <Input type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} className="h-8 w-16" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Minutes</Label>
                    <Input type="number" min={0} max={59} value={m} onChange={(e) => setM(e.target.value)} className="h-8 w-16" />
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto h-8"
                    onClick={async () => {
                      const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
                      if (mins > 0) await onAdjust(mins);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
}

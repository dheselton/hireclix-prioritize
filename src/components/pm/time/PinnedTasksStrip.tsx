import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Star, Play, Square, Plus, X } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { usePinnedTasks, unpinTask, type PinnedTask } from "@/lib/pm/pinnedTasks";
import { useActiveTimer, formatHMS } from "@/components/pm/timer/ActiveTimerProvider";
import { addTimeEntry, fmtDur, localDateISO } from "@/lib/pm/time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PinnedTasksStrip({ onLogged }: { onLogged?: () => void }) {
  const { user } = useCurrentUser();
  const { tasks, reload } = usePinnedTasks(user?.id);
  const { current, elapsedMs, startTask, stop, isRunningTask } = useActiveTimer();
  const [runningNote, setRunningNote] = useState("");

  async function quickLog(task: PinnedTask, mins: number, note = "") {
    if (!user) { toast.error("Select a user first"); return; }
    await addTimeEntry({
      task_id: task.id,
      user_id: user.id,
      minutes: mins,
      note,
      logged_at: localDateISO(new Date()),
      billable: true,
    });
    toast.success(`Logged ${fmtDur(mins)} to ${task.title}`);
    onLogged?.();
  }

  async function handleStop() {
    await stop(runningNote);
    setRunningNote("");
  }

  async function handleStart(t: PinnedTask) {
    setRunningNote("");
    await startTask(t.id, t.title);
  }

  async function handleUnpin(t: PinnedTask) {
    if (!user) return;
    await unpinTask(user.id, t.id);
    reload();
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pinned tasks</span>
          <span className="text-[11px] text-muted-foreground">One-click log for ongoing work</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tasks.length === 0 && (
          <span className="text-xs text-muted-foreground italic px-1 py-2">
            No pinned tasks yet. Open any task and click the star to pin it here.
          </span>
        )}
        {tasks.map(t => {
          const running = isRunningTask(t.id);
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-1 rounded-full border bg-card pl-1 pr-1 py-0.5 transition",
                running ? "border-primary/60 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              )}
            >
              <button
                onClick={() => running ? handleStop() : handleStart(t)}
                className={cn(
                  "h-7 w-7 rounded-full inline-flex items-center justify-center text-white bg-primary",
                  running && "bg-destructive"
                )}
                title={running ? "Stop timer" : `Start timer on ${t.title}`}
              >
                {running ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
              </button>
              <Link to={`/pm/tasks/${t.id}`} className="text-sm font-medium px-1.5 hover:underline max-w-[220px] truncate" title={t.title}>
                {t.title}
              </Link>
              {running && (
                <>
                  <span className="text-xs tabular-nums text-primary px-1.5">{formatHMS(elapsedMs)}</span>
                  <Input
                    value={runningNote}
                    onChange={e => setRunningNote(e.target.value)}
                    placeholder="What are you working on?"
                    className="h-7 w-56 text-xs"
                  />
                </>
              )}
              <QuickLogMenu onPick={(m, n) => quickLog(t, m, n)} />
              <button
                onClick={() => handleUnpin(t)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
                title="Unpin"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function QuickLogMenu({ onPick }: { onPick: (mins: number, note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [note, setNote] = useState("");

  function pick(mins: number) {
    onPick(mins, note);
    setH(""); setM(""); setNote("");
    setOpen(false);
  }

  function save() {
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) { toast.error("Enter a duration"); return; }
    pick(mins);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground" title="Log time">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 z-50 bg-popover" align="end">
        <div className="text-xs font-medium text-muted-foreground mb-2">Log time today</div>
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="flex gap-1.5 mb-2">
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => pick(15)}>+15m</Button>
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => pick(30)}>+30m</Button>
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => pick(60)}>+1h</Button>
        </div>
        <div className="flex gap-1.5">
          <Input type="number" min={0} placeholder="h" value={h} onChange={e => setH(e.target.value)} className="h-8 w-14" />
          <Input type="number" min={0} max={59} placeholder="m" value={m} onChange={e => setM(e.target.value)} className="h-8 w-14" />
          <Button size="sm" className="ml-auto h-8" onClick={save}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

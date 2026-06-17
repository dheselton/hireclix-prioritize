import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Plus, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useActiveTimer, formatHMS } from "@/components/pm/timer/ActiveTimerProvider";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { DatePicker } from "@/components/ui/date-picker";
import { addTimeEntry, deleteTimeEntry, fmtDur, localDateISO, useEnrichedEntries } from "@/lib/pm/time";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function TimeTrackerCard({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { current, elapsedMs, start, stop, isRunning } = useActiveTimer();
  const { user, role } = useCurrentUser();
  const users = useMockUsers();
  const running = isRunning(taskId);
  const otherRunning = !!current && !running;

  const today = localDateISO(new Date());
  const { entries, reload } = useEnrichedEntries({ taskId }, [taskId]);
  const todayTotal = entries.filter(e => e.logged_at.slice(0, 10) === today).reduce((s, e) => s + e.minutes, 0);
  const taskTotal = entries.reduce((s, e) => s + e.minutes, 0);

  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState("");

  async function logManual() {
    if (!user) { toast.error("Select a user first"); return; }
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) { toast.error("Enter a duration"); return; }
    await addTimeEntry({ task_id: taskId, user_id: user.id, minutes: mins, note, logged_at: date });
    setH(""); setM(""); setNote("");
    toast.success(`Logged ${fmtDur(mins)}`);
    reload();
  }

  async function quick(min: number) {
    if (!user) { toast.error("Select a user first"); return; }
    await addTimeEntry({ task_id: taskId, user_id: user.id, minutes: min, note: "", logged_at: today });
    toast.success(`Logged ${min}m`);
    reload();
  }

  const recent = entries.slice(0, 5);

  return (
    <Card className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</div>
        <div className="text-[11px] text-muted-foreground">
          Today <span className="font-medium text-foreground">{fmtDur(todayTotal)}</span>
          <span className="mx-1.5">·</span>
          Total <span className="font-medium text-foreground">{fmtDur(taskTotal)}</span>
        </div>
      </div>

      {/* Timer */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
        <div className="tabular-nums text-lg font-semibold">
          {running ? formatHMS(elapsedMs) : "00:00:00"}
        </div>
        {running ? (
          <Button size="sm" variant="destructive" onClick={() => stop()}>
            <Square className="h-3 w-3 mr-1 fill-current" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => start(taskId, taskTitle)} title={otherRunning ? `Will stop "${current?.taskTitle}"` : ""}>
            <Play className="h-3 w-3 mr-1 fill-current" /> Start
          </Button>
        )}
      </div>

      {/* Manual entry */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-muted-foreground">Log time</div>
        <div className="flex gap-1.5">
          <Input type="number" min={0} placeholder="h" value={h} onChange={e => setH(e.target.value)} className="h-8 w-14" />
          <Input type="number" min={0} max={59} placeholder="m" value={m} onChange={e => setM(e.target.value)} className="h-8 w-14" />
          <div className="flex-1 min-w-0">
            <DatePicker value={date} onChange={(v) => setDate(v ?? today)} />
          </div>
        </div>
        <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="h-8" />
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => quick(15)}>+15m</Button>
          <Button size="sm" variant="outline" onClick={() => quick(30)}>+30m</Button>
          <Button size="sm" variant="outline" onClick={() => quick(60)}>+1h</Button>
          <Button size="sm" className="ml-auto" onClick={logManual}><Plus className="h-3 w-3 mr-1" /> Save</Button>
        </div>
      </div>

      {/* Recent */}
      <div className="border-t border-border pt-2 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-muted-foreground">Recent entries</div>
          <Link to={`/pm/time?task=${taskId}`} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
            View all <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 && <div className="text-xs text-muted-foreground italic px-1">No time logged yet.</div>}
        {recent.map(e => {
          const u = users.find(x => x.id === e.user_id);
          const canDelete = role === "pm" || e.user_id === user?.id;
          return (
            <div key={e.id} className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/40">
              <UserAvatar userId={e.user_id} size="xs" />
              <span className="font-medium truncate flex-1 min-w-0">{u?.name ?? "—"}</span>
              <span className="text-muted-foreground">{fmtDate(e.logged_at.slice(0, 10))}</span>
              <span className="tabular-nums w-14 text-right">{fmtDur(e.minutes)}</span>
              {canDelete && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={async () => { await deleteTimeEntry(e.id); reload(); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

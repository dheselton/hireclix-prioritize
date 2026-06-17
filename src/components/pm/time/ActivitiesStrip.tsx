import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Activity, Plus, Play, Square, Settings, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { useActivities, createActivity, updateActivity, archiveActivity, unarchiveActivity, deleteActivity, type PmActivity } from "@/lib/pm/activities";
import { useActiveTimer, formatHMS } from "@/components/pm/timer/ActiveTimerProvider";
import { addTimeEntry, fmtDur, localDateISO } from "@/lib/pm/time";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#10b981", "#64748b", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#ef4444"];

export function ActivitiesStrip({ onLogged }: { onLogged?: () => void }) {
  const { activities, reload } = useActivities();
  const { user, role } = useCurrentUser();
  const { current, elapsedMs, startActivity, stop, isRunningActivity } = useActiveTimer();
  const [manageOpen, setManageOpen] = useState(false);

  async function quickLog(activity: PmActivity, mins: number) {
    if (!user) { toast.error("Select a user first"); return; }
    await addTimeEntry({
      activity_id: activity.id,
      user_id: user.id,
      minutes: mins,
      logged_at: localDateISO(new Date()),
      billable: activity.billable_default,
    });
    toast.success(`Logged ${fmtDur(mins)} to ${activity.name}`);
    onLogged?.();
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overhead activities</span>
          <span className="text-[11px] text-muted-foreground">Log time without creating a task</span>
        </div>
        {role === "pm" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setManageOpen(true)}>
            <Settings className="h-3 w-3 mr-1" /> Manage
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {activities.length === 0 && (
          <span className="text-xs text-muted-foreground italic px-1 py-2">No activities yet.</span>
        )}
        {activities.map(a => {
          const running = isRunningActivity(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-1 rounded-full border bg-card pl-1 pr-1 py-0.5 transition",
                running ? "border-primary/60 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              )}
            >
              <button
                onClick={() => running ? stop() : startActivity(a.id, a.name)}
                className={cn(
                  "h-7 w-7 rounded-full inline-flex items-center justify-center text-white",
                  running ? "bg-destructive" : ""
                )}
                style={!running && a.color ? { backgroundColor: a.color } : undefined}
                title={running ? "Stop timer" : `Start timer on ${a.name}`}
              >
                {running ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
              </button>
              <span className="text-sm font-medium px-1.5">{a.name}</span>
              {running && (
                <span className="text-xs font-mono tabular-nums text-primary px-1.5">
                  {formatHMS(elapsedMs)}
                </span>
              )}
              <QuickLogMenu onPick={(m) => quickLog(a, m)} />
            </div>
          );
        })}
      </div>

      <ManageActivitiesDialog open={manageOpen} onOpenChange={setManageOpen} onChanged={reload} />
    </Card>
  );
}

function QuickLogMenu({ onPick }: { onPick: (mins: number) => void }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState("");
  const [m, setM] = useState("");

  function save() {
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) { toast.error("Enter a duration"); return; }
    onPick(mins);
    setH(""); setM("");
    setOpen(false);
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
        <div className="flex gap-1.5 mb-2">
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => onPick(15)}>+15m</Button>
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => onPick(30)}>+30m</Button>
          <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => onPick(60)}>+1h</Button>
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

function ManageActivitiesDialog({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (v: boolean) => void; onChanged: () => void }) {
  const { activities, reload } = useActivities({ includeArchived: true });
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  async function add() {
    if (!name.trim()) return;
    await createActivity({ name: name.trim(), color });
    setName(""); setColor(COLORS[0]);
    reload(); onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Activities</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Activities are time-tracking buckets that aren't tasks. They never show up on boards or in workload.
          </p>
        </DialogHeader>

        <div className="space-y-1.5 border-b border-border pb-3">
          <div className="text-xs font-medium text-muted-foreground">Add new</div>
          <div className="flex gap-2">
            <Input placeholder="e.g. Meetings" value={name} onChange={e => setName(e.target.value)} className="h-9 flex-1" />
            <Button onClick={add} size="sm" className="h-9"><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          <div className="flex gap-1.5 pt-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn("h-6 w-6 rounded-full border-2 transition", color === c ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="max-h-[320px] overflow-auto space-y-1">
          {activities.map(a => (
            <ActivityRow key={a.id} activity={a} onChanged={() => { reload(); onChanged(); }} />
          ))}
          {activities.length === 0 && (
            <div className="text-sm text-muted-foreground italic py-4 text-center">No activities yet.</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityRow({ activity, onChanged }: { activity: PmActivity; onChanged: () => void }) {
  const [name, setName] = useState(activity.name);
  const [color, setColor] = useState(activity.color ?? COLORS[0]);

  async function save() {
    if (name !== activity.name || color !== activity.color) {
      await updateActivity(activity.id, { name, color });
      onChanged();
    }
  }

  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40", activity.is_archived && "opacity-50")}>
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        onBlur={save}
        className="h-6 w-6 rounded border border-border cursor-pointer"
      />
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={save}
        className="h-8 flex-1"
      />
      {activity.is_archived ? (
        <Button size="sm" variant="ghost" className="h-7" onClick={async () => { await unarchiveActivity(activity.id); onChanged(); }}>
          <ArchiveRestore className="h-3 w-3" />
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="h-7" onClick={async () => { await archiveActivity(activity.id); onChanged(); }}>
          <Archive className="h-3 w-3" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-destructive"
        onClick={async () => {
          if (!confirm(`Delete "${activity.name}"? Existing time entries will be detached.`)) return;
          await deleteActivity(activity.id);
          onChanged();
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import {
  addTimeEntry,
  deleteTimeEntry,
  updateTimeEntry,
  fmtDur,
  localDateISO,
  useEnrichedEntries,
  type EnrichedEntry,
} from "@/lib/pm/time";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, ExternalLink } from "lucide-react";

export function TimeLogDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user, roles } = useCurrentUser();
  const users = useMockUsers();
  const today = localDateISO(new Date());
  const { entries, reload } = useEnrichedEntries({ taskId }, [taskId, open]);

  const todayTotal = entries
    .filter(e => e.logged_at.slice(0, 10) === today)
    .reduce((s, e) => s + e.minutes, 0);
  const taskTotal = entries.reduce((s, e) => s + e.minutes, 0);

  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState("");

  async function logManual() {
    if (!user) return toast.error("Select a user first");
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) return toast.error("Enter a duration");
    await addTimeEntry({ task_id: taskId, user_id: user.id, minutes: mins, note, logged_at: date });
    setH(""); setM(""); setNote("");
    toast.success(`Logged ${fmtDur(mins)}`);
    reload();
  }

  async function quick(min: number) {
    if (!user) return toast.error("Select a user first");
    await addTimeEntry({ task_id: taskId, user_id: user.id, minutes: min, note: "", logged_at: today });
    toast.success(`Logged ${min}m`);
    reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base">Time</DialogTitle>
          <div className="text-xs text-muted-foreground">
            Today <span className="font-medium text-foreground">{fmtDur(todayTotal)}</span>
            <span className="mx-1.5">·</span>
            Total <span className="font-medium text-foreground">{fmtDur(taskTotal)}</span>
          </div>
        </DialogHeader>

        {/* Log time */}
        <div className="px-5 py-4 space-y-2 border-b border-border">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Log time</div>
          <div className="flex gap-1.5">
            <Input type="number" min={0} placeholder="h" value={h} onChange={e => setH(e.target.value)} className="h-9 w-16" />
            <Input type="number" min={0} max={59} placeholder="m" value={m} onChange={e => setM(e.target.value)} className="h-9 w-16" />
            <div className="flex-1 min-w-0">
              <DatePicker value={date} onChange={(v) => setDate(v ?? today)} />
            </div>
          </div>
          <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="h-9" />
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => quick(15)}>+15m</Button>
            <Button size="sm" variant="outline" onClick={() => quick(30)}>+30m</Button>
            <Button size="sm" variant="outline" onClick={() => quick(60)}>+1h</Button>
            <Button size="sm" className="ml-auto" onClick={logManual}>
              <Plus className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>

        {/* Entries */}
        <div className="px-5 py-3 max-h-[280px] overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Entries ({entries.length})
            </div>
            <Link
              to={`/pm/time?task=${taskId}`}
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
            >
              View all <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {entries.length === 0 && (
            <div className="text-xs text-muted-foreground italic py-4 text-center">No time logged yet.</div>
          )}
          <div className="space-y-1">
            {entries.map(e => (
              <EntryRow
                key={e.id}
                entry={e}
                userName={users.find(u => u.id === e.user_id)?.name}
                canEdit={roles.includes("pm") || e.user_id === user?.id}
                onChanged={reload}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntryRow({
  entry,
  userName,
  canEdit,
  onChanged,
}: {
  entry: EnrichedEntry;
  userName?: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [h, setH] = useState(String(Math.floor(entry.minutes / 60)));
  const [m, setM] = useState(String(entry.minutes % 60));
  const [date, setDate] = useState(entry.logged_at.slice(0, 10));
  const [note, setNote] = useState(entry.note ?? "");

  async function save() {
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) return toast.error("Duration required");
    await updateTimeEntry(entry.id, { minutes: mins, logged_at: date, note });
    setEditing(false);
    toast.success("Updated");
    onChanged();
  }

  async function remove() {
    await deleteTimeEntry(entry.id);
    toast.success("Deleted");
    onChanged();
  }

  if (editing) {
    return (
      <div className="rounded-md border border-border p-2 space-y-1.5 bg-muted/30">
        <div className="flex gap-1.5">
          <Input type="number" min={0} value={h} onChange={e => setH(e.target.value)} className="h-8 w-14" />
          <Input type="number" min={0} max={59} value={m} onChange={e => setM(e.target.value)} className="h-8 w-14" />
          <div className="flex-1 min-w-0">
            <DatePicker value={date} onChange={(v) => setDate(v ?? date)} />
          </div>
        </div>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="h-8" />
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={save}>
            <Check className="h-3 w-3 mr-1" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs px-1.5 py-1.5 rounded hover:bg-muted/40 group">
      <UserAvatar userId={entry.user_id} size="xs" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{userName ?? "—"}</div>
        {entry.note && <div className="text-muted-foreground truncate">{entry.note}</div>}
      </div>
      <span className="text-muted-foreground whitespace-nowrap">{fmtDate(entry.logged_at.slice(0, 10))}</span>
      <span className="tabular-nums w-12 text-right font-medium">{fmtDur(entry.minutes)}</span>
      {canEdit && (
        <div className="flex touch-action">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={remove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { addTimeEntry, deleteTimeEntry, updateTimeEntry, fmtDur, type EnrichedEntry } from "@/lib/pm/time";
import { toast } from "sonner";

interface Props {
  /** Provide one of taskId OR activityId. */
  taskId?: string | null;
  activityId?: string | null;
  taskTitle: string;
  dateISO: string; // yyyy-mm-dd
  entries: EnrichedEntry[];
  children: React.ReactNode;
  onChange?: () => void;
}

export function EntryPopover({ taskId, activityId, taskTitle, dateISO, entries, children, onChange }: Props) {
  const { user, role } = useCurrentUser();
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [note, setNote] = useState("");
  const canEdit = (e: EnrichedEntry) => role === "pm" || e.user_id === user?.id;

  async function add() {
    if (!user) return;
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) { toast.error("Enter a duration"); return; }
    await addTimeEntry({
      task_id: taskId ?? null,
      activity_id: activityId ?? null,
      user_id: user.id,
      minutes: mins,
      note,
      logged_at: dateISO,
    });
    setH(""); setM(""); setNote("");
    onChange?.();
    toast.success(`Logged ${fmtDur(mins)}`);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-0 z-50 bg-popover" align="start">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-xs text-muted-foreground">{fmtDate(dateISO)}</div>
          <div className="text-sm font-medium truncate">
            {activityId && <span className="text-[10px] uppercase tracking-wide text-amber-600 mr-1">Activity ·</span>}
            {taskTitle}
          </div>
        </div>
        <div className="max-h-64 overflow-auto divide-y divide-border">
          {entries.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground italic">No entries on this day</div>
          )}
          {entries.map(e => (
            <EntryRow key={e.id} entry={e} canEdit={canEdit(e)} onChange={onChange} />
          ))}
        </div>
        <div className="border-t border-border p-3 space-y-2 bg-muted/20">
          <div className="text-xs font-medium text-muted-foreground">Add entry</div>
          <div className="flex gap-1.5">
            <Input type="number" min={0} placeholder="h" value={h} onChange={e => setH(e.target.value)} className="h-8 w-14" />
            <Input type="number" min={0} max={59} placeholder="m" value={m} onChange={e => setM(e.target.value)} className="h-8 w-14" />
            <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="h-8 flex-1" />
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => { setH("0"); setM("15"); }}>+15m</Button>
            <Button size="sm" variant="outline" onClick={() => { setH("0"); setM("30"); }}>+30m</Button>
            <Button size="sm" variant="outline" onClick={() => { setH("1"); setM("0"); }}>+1h</Button>
            <Button size="sm" className="ml-auto" onClick={add}><Plus className="h-3 w-3 mr-1" />Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EntryRow({ entry, canEdit, onChange }: { entry: EnrichedEntry; canEdit: boolean; onChange?: () => void }) {
  const users = useMockUsers();
  const u = users.find(x => x.id === entry.user_id);
  const [editing, setEditing] = useState(false);
  const [h, setH] = useState(String(Math.floor(entry.minutes / 60)));
  const [m, setM] = useState(String(entry.minutes % 60));
  const [note, setNote] = useState(entry.note ?? "");

  async function save() {
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) { toast.error("Duration required"); return; }
    await updateTimeEntry(entry.id, { minutes: mins, note });
    setEditing(false);
    onChange?.();
  }
  async function remove() {
    await deleteTimeEntry(entry.id);
    onChange?.();
  }

  if (editing) {
    return (
      <div className="px-3 py-2 space-y-1.5 bg-muted/30">
        <div className="flex gap-1.5">
          <Input type="number" min={0} value={h} onChange={e => setH(e.target.value)} className="h-7 w-14 text-xs" />
          <Input type="number" min={0} max={59} value={m} onChange={e => setM(e.target.value)} className="h-7 w-14 text-xs" />
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="h-7 flex-1 text-xs" />
        </div>
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditing(false)}><X className="h-3 w-3" /></Button>
          <Button size="sm" className="h-6 px-2" onClick={save}><Check className="h-3 w-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 flex items-start gap-2 text-sm">
      <UserAvatar userId={entry.user_id} size="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium truncate">{u?.name ?? "Unknown"}</span>
          <span className="text-xs font-mono tabular-nums">{fmtDur(entry.minutes)}</span>
        </div>
        {entry.note && <div className="text-xs text-muted-foreground truncate">{entry.note}</div>}
      </div>
      {canEdit && (
        <div className="flex gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={remove}><Trash2 className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

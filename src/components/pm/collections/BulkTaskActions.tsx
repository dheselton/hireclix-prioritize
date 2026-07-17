import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMockUsers } from "@/lib/pm/mockUser";
import { TASK_STATUSES, type TaskStatus } from "@/types/pm";
import { updateTask } from "@/lib/pm/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Props {
  selected: Set<string>;
  onClear: () => void;
  onChanged?: () => void;
}

export function BulkTaskActions({ selected, onClear, onChanged }: Props) {
  const users = useMockUsers();
  if (!selected.size) return null;

  async function bulkStatus(status: TaskStatus) {
    await Promise.all(Array.from(selected).map(id => updateTask(id, { status })));
    toast.success(`Updated ${selected.size} task${selected.size === 1 ? "" : "s"}`);
    onClear();
    onChanged?.();
  }
  async function bulkAssign(userId: string | null) {
    await Promise.all(Array.from(selected).map(id => updateTask(id, { assignee_id: userId })));
    toast.success(`Reassigned ${selected.size} task${selected.size === 1 ? "" : "s"}`);
    onClear();
    onChanged?.();
  }
  async function bulkDelete() {
    const n = selected.size;
    if (!confirm(`Delete ${n} task${n === 1 ? "" : "s"}? This cannot be undone.`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("pm_tasks").delete().in("id", ids);
    if (error) { toast.error("Couldn't delete tasks"); return; }
    toast.success(`Deleted ${n} task${n === 1 ? "" : "s"}`);
    onClear();
    onChanged?.();
  }

  return (
    <div className="sticky top-2 z-20 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background/95 backdrop-blur shadow-sm text-sm flex-wrap">
      <span className="font-medium">{selected.size} selected</span>
      <Select onValueChange={(v) => bulkStatus(v as TaskStatus)}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Change status" /></SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => bulkAssign(v === "none" ? null : v)}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Reassign" /></SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          <SelectItem value="none">Unassigned</SelectItem>
          {users.filter(u => u.role !== "submitter").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="destructive" size="sm" onClick={bulkDelete} className="h-8">
        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
    </div>
  );
}

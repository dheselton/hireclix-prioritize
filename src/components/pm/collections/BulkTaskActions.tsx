import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMockUsers } from "@/lib/pm/mockUser";
import { TASK_STATUSES, type TaskStatus } from "@/types/pm";
import { updateTask } from "@/lib/pm/api";
import { toast } from "sonner";

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

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm flex-wrap">
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
      <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
    </div>
  );
}

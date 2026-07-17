import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMockUsers } from "@/lib/pm/mockUser";
import { TASK_STATUSES, type TaskStatus } from "@/types/pm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";

interface Props {
  selected: Set<string>;
  onClear: () => void;
  onChanged?: () => void;
}

export function BulkTaskActions({ selected, onClear, onChanged }: Props) {
  const users = useMockUsers();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = selected.size;
  if (!n) return null;

  const ids = Array.from(selected);
  const plural = n === 1 ? "" : "s";

  async function run(label: string, fn: () => Promise<{ error: unknown } | null>) {
    if (busy) return;
    setBusy(true);
    const { error } = (await fn()) ?? { error: null };
    setBusy(false);
    if (error) { toast.error(`Couldn't ${label.toLowerCase()}`); return; }
    toast.success(`${label} ${n} task${plural}`);
    onClear();
    onChanged?.();
  }

  const bulkStatus = (status: TaskStatus) =>
    run("Updated", async () => await supabase.from("pm_tasks").update({ status }).in("id", ids));

  const bulkAssign = (userId: string | null) =>
    run("Reassigned", async () => await supabase.from("pm_tasks").update({ assignee_id: userId }).in("id", ids));

  const bulkDelete = () =>
    run("Deleted", async () => await supabase.from("pm_tasks").delete().in("id", ids));

  const bar = (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-popover shadow-lg text-sm">
        <span className="pl-2 pr-1 font-medium tabular-nums">{n} selected</span>
        <span className="h-5 w-px bg-border mx-1" />
        <Select onValueChange={(v) => bulkStatus(v as TaskStatus)} disabled={busy}>
          <SelectTrigger className="h-8 w-40 rounded-full"><SelectValue placeholder="Change status" /></SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => bulkAssign(v === "none" ? null : v)} disabled={busy}>
          <SelectTrigger className="h-8 w-40 rounded-full"><SelectValue placeholder="Reassign" /></SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="none">Unassigned</SelectItem>
            {users.filter(u => u.role !== "submitter").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={busy} className="h-8 rounded-full">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          title="Clear selection (Esc)"
          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {typeof document !== "undefined" ? createPortal(bar, document.body) : bar}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {n} task{plural}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Subtasks, comments, and time entries on these tasks will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={bulkDelete}
            >
              Delete {n} task{plural}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

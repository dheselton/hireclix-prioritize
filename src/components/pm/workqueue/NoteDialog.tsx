import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { toast } from "sonner";
import { createNote, updateNote, deleteNote, type PmNote } from "@/lib/pm/briefing";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  note?: PmNote | null;
}

export function NoteDialog({ open, onClose, userId, note }: Props) {
  const isEdit = !!note;
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(note?.content ?? "");
      setDueDate(note?.due_date ?? null);
      setCompleted(note?.is_completed ?? false);
    }
  }, [open, note]);

  async function handleSave() {
    if (!content.trim()) {
      toast.error("Add some content first.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && note) {
        await updateNote(note.id, { content: content.trim(), due_date: dueDate, is_completed: completed });
      } else {
        await createNote({ user_id: userId, content: content.trim(), due_date: dueDate });
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    try {
      await deleteNote(note.id);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit note" : "Add a note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="note-content">Note</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a note or reminder..."
              rows={4}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Due date (optional)</Label>
            <DatePicker value={dueDate} onChange={setDueDate} placeholder="No due date" />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={completed} onCheckedChange={(v) => setCompleted(!!v)} />
              <span className="text-sm">Mark as completed</span>
            </label>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2 sm:justify-between">
          <div>
            {isEdit && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{isEdit ? "Save" : "Add note"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this note?"
        description="This note will be permanently removed. This cannot be undone."
        confirmLabel="Delete note"
        onConfirm={handleDelete}
      />
    </>
  );
}

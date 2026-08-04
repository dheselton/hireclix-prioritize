import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/pm/project/RichTextEditor";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { sanitizeHtml } from "@/lib/pm/sanitizeHtml";
import { fmtDate } from "@/lib/pm/format";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import {
  createClientNote,
  deleteClientNote,
  updateClientNote,
  useClientNotes,
  type ClientNote,
} from "@/lib/pm/clientHub";

export function ClientNotesTab({ clientId }: { clientId: string }) {
  const { notes, loading, reload } = useClientNotes(clientId);
  const { user } = useCurrentUser();
  const users = useMockUsers();
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [toDelete, setToDelete] = useState<ClientNote | null>(null);
  const [saving, setSaving] = useState(false);

  const nameFor = (id: string | null) =>
    (id && (users.users ?? []).find((u: any) => u.id === id)?.name) || "Someone";

  async function save() {
    if (!draft.trim() || draft === "<p></p>") { toast.error("Write something first"); return; }
    setSaving(true);
    try {
      await createClientNote(clientId, sanitizeHtml(draft), user?.id ?? null);
      setDraft(""); setDrafting(false);
      await reload();
      toast.success("Note added");
    } catch (e: any) {
      toast.error(`Couldn't save note: ${e.message ?? e}`);
    }
    setSaving(false);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await updateClientNote(id, sanitizeHtml(editBody));
      setEditingId(null);
      await reload();
      toast.success("Note updated");
    } catch (e: any) {
      toast.error(`Couldn't update note: ${e.message ?? e}`);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Account context, caveats, and things the team should know before touching this client's work.
        </p>
        {!drafting && (
          <Button size="sm" onClick={() => setDrafting(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add note
          </Button>
        )}
      </div>

      {drafting && (
        <Card className="p-3 space-y-2">
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="e.g. Always route job feed changes through their IT contact first…"
            users={users.users ?? []}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDrafting(false); setDraft(""); }}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>Save note</Button>
          </div>
        </Card>
      )}

      {loading && <Skeleton className="h-24 w-full" />}
      {!loading && notes.length === 0 && !drafting && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      {notes.map(n => (
        <Card key={n.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {nameFor(n.author_id)} · {fmtDate(n.created_at)}
              {n.updated_at !== n.created_at && " · edited"}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon" variant="ghost" className="h-7 w-7"
                aria-label="Edit note"
                onClick={() => { setEditingId(n.id); setEditBody(n.body); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                aria-label="Delete note"
                onClick={() => setToDelete(n)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {editingId === n.id ? (
            <div className="space-y-2">
              <RichTextEditor value={editBody} onChange={setEditBody} users={users.users ?? []} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" onClick={() => saveEdit(n.id)} disabled={saving}>Save</Button>
              </div>
            </div>
          ) : (
            <div
              className="text-sm prose-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.body) }}
            />
          )}
        </Card>
      ))}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={o => !o && setToDelete(null)}
        title="Delete this note?"
        description="This removes the note for everyone on the team."
        confirmLabel="Delete note"
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteClientNote(toDelete.id);
            await reload();
            toast.success("Note deleted");
          } catch (e: any) {
            toast.error(`Couldn't delete note: ${e.message ?? e}`);
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

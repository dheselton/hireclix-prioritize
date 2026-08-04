import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateClient, type ClientRecord } from "@/lib/pm/clientHub";
import { refreshInternalClients } from "@/lib/pm/clients";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: ClientRecord;
  onSaved: () => void;
}

export function EditClientDialog({ open, onOpenChange, client, onSaved }: Props) {
  const [name, setName] = useState(client.name);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [internal, setInternal] = useState(client.is_internal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(client.name);
      setNotes(client.notes ?? "");
      setInternal(client.is_internal);
    }
  }, [open, client]);

  async function save() {
    if (!name.trim()) { toast.error("Client name is required"); return; }
    setSaving(true);
    try {
      await updateClient(client.id, { name: name.trim(), notes: notes.trim() || null, is_internal: internal });
      await refreshInternalClients();
      onSaved();
      onOpenChange(false);
      toast.success("Client updated");
    } catch (e: any) {
      toast.error(`Couldn't update client: ${e.message ?? e}`);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Name</Label>
            <Input id="client-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-notes">Short description</Label>
            <Textarea
              id="client-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="One-liner about this account…"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Internal client</div>
              <div className="text-xs text-muted-foreground">Marks work as HireClix internal (purple treatment).</div>
            </div>
            <Switch checked={internal} onCheckedChange={setInternal} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  clientLogoPublicUrl,
  removeClientLogo,
  updateClient,
  uploadClientLogo,
  type ClientRecord,
} from "@/lib/pm/clientHub";
import { refreshClientBrands, refreshInternalClients } from "@/lib/pm/clients";
import { ClientLogo } from "@/components/pm/client/ClientLogo";
import { Trash2, Upload } from "lucide-react";

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
  const [logoPath, setLogoPath] = useState(client.logo_path);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(client.name);
      setNotes(client.notes ?? "");
      setInternal(client.is_internal);
      setLogoPath(client.logo_path);
    }
  }, [open, client]);

  async function save() {
    if (!name.trim()) { toast.error("Client name is required"); return; }
    setSaving(true);
    try {
      await updateClient(client.id, { name: name.trim(), notes: notes.trim() || null, is_internal: internal });
      await refreshInternalClients();
      await refreshClientBrands();
      onSaved();
      onOpenChange(false);
      toast.success("Client updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't update client");
    }
    setSaving(false);
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setLogoBusy(true);
    try {
      const path = await uploadClientLogo(client.id, file);
      setLogoPath(path);
      await refreshClientBrands();
      onSaved();
      toast.success("Logo uploaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload logo");
    }
    setLogoBusy(false);
  }

  async function clearLogo() {
    setLogoBusy(true);
    try {
      await removeClientLogo(client.id, logoPath);
      setLogoPath(null);
      await refreshClientBrands();
      onSaved();
      toast.success("Logo removed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove logo");
    }
    setLogoBusy(false);
  }

  const logoUrl = clientLogoPublicUrl(logoPath);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <ClientLogo name={name || client.name} logoUrl={logoUrl} size="lg" />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={logoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {logoBusy ? "Uploading…" : logoPath ? "Replace" : "Upload"}
                </Button>
                {logoPath && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={logoBusy}
                    onClick={() => void clearLogo()}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onLogoFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Shown on Live Career Sites cards and project headers.
            </p>
          </div>
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

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/pm/clientHub";

interface Props {
  onCreated: (client: { id: string; name: string }) => void;
  trigger?: React.ReactNode;
}

export function NewClientPopover({ onCreated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = name.trim();
    if (!n) { toast.error("Client name is required"); return; }
    setBusy(true);
    try {
      const data = await createClient({ name: n, notes: notes.trim() || null });
      toast.success(`Created client "${data.name}"`);
      onCreated(data);
      setName(""); setNotes(""); setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> New client
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 z-50 bg-popover" align="end">
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Client name</Label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); }}
              placeholder="Acme Corp"
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal context…"
              className="h-8"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={busy || !name.trim()}>Create</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

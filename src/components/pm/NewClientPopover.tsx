import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/pm/clientHub";
import { clientNameKey, normalizeClientName } from "@/lib/pm/identity";

interface ExistingClient {
  id: string;
  name: string;
  archived_at?: string | null;
}

interface Props {
  onCreated: (client: { id: string; name: string }) => void;
  trigger?: React.ReactNode;
  /** Known clients used to surface “use existing” before insert. */
  existingClients?: ExistingClient[];
}

export function NewClientPopover({ onCreated, trigger, existingClients = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const match = useMemo(() => {
    const key = clientNameKey(name);
    if (!key) return null;
    return existingClients.find((c) => clientNameKey(c.name) === key) ?? null;
  }, [name, existingClients]);

  function reset() {
    setName("");
    setNotes("");
    setIsInternal(false);
  }

  async function save() {
    const n = normalizeClientName(name);
    if (!n) { toast.error("Client name is required"); return; }
    setBusy(true);
    try {
      const data = await createClient({
        name: n,
        notes: notes.trim() || null,
        is_internal: isInternal,
      });
      if (data.existed) {
        toast.success(
          data.restored
            ? `Restored existing client "${data.name}"`
            : `Using existing client "${data.name}"`,
        );
      } else {
        toast.success(`Created client "${data.name}"`);
      }
      onCreated({ id: data.id, name: data.name });
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> New client
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 z-50 bg-popover" align="end">
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Client name</Label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void save(); }}
              placeholder="Acme Corp"
              className="h-8"
            />
            {match && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                Already exists as <span className="font-medium">{match.name}</span>
                {match.archived_at ? " (archived — will restore)" : ""}. We’ll use that record instead of creating a duplicate.
              </p>
            )}
          </div>
          {!match && (
            <>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal context…"
                  className="h-8"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={isInternal}
                  onCheckedChange={(v) => setIsInternal(!!v)}
                />
                Internal (HireClix / non-client work)
              </label>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => void save()} disabled={busy || !name.trim()}>
              {match ? "Use existing" : "Create"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { createSiteInitiative, type SiteInitiativeKind } from "@/lib/pm/siteInitiatives";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LiveSiteSummary } from "@/lib/pm/liveSites";

type SiteOption = LiveSiteSummary & {
  clientName: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sites: SiteOption[];
  onCreated?: (initiativeId: string) => void;
}

export function CreateSiteInitiativeDialog({
  open,
  onOpenChange,
  sites,
  onCreated,
}: Props) {
  const { user } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SiteInitiativeKind>("maintenance");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(user?.id ?? null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setKind("maintenance");
    setDescription("");
    setDueDate("");
    setOwnerId(user?.id ?? null);
    setFilter("");
    setSelected(new Set());
  }, [open, user?.id]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.clientName ?? "").toLowerCase().includes(q),
    );
  }, [sites, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filtered) next.add(s.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one live site");
      return;
    }
    setSaving(true);
    try {
      const { initiative, itemCount } = await createSiteInitiative({
        title: title.trim(),
        kind,
        description: description.trim() || null,
        dueDate: dueDate || null,
        ownerId,
        createdBy: user?.id ?? null,
        siteProjectIds: Array.from(selected),
      });
      toast.success(`Created initiative across ${itemCount} sites`);
      onOpenChange(false);
      onCreated?.(initiative.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't create initiative");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New multi-site initiative</DialogTitle>
          <DialogDescription>
            Creates one umbrella project plus a support request under each selected live
            site so rollout work stays visible in every site&apos;s Support queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Accessibility audit rollout"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as SiteInitiativeKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <DatePicker value={dueDate} onChange={(v) => setDueDate(v ?? "")} className="w-full" />
            </div>
          </div>

          <RequesterPicker
            value={ownerId}
            onChange={setOwnerId}
            label="Owner"
            helpText="Optional — shown as the requester on each site rollout request."
          />

          <div>
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shared scope for the rollout…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Affected live sites * ({selected.size} selected)</Label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={selectAllFiltered}
                >
                  Select filtered
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={clearSelection}
                >
                  Clear
                </button>
              </div>
            </div>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by site or client…"
              className="h-8"
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No live sites match.</p>
              ) : (
                filtered.map((s) => {
                  const checked = selected.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40",
                        checked && "bg-muted/30",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(s.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{s.title}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {s.clientName ?? "No client"}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Creating…" : `Create for ${selected.size || "…"} sites`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

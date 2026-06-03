import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockUsers } from "@/lib/pm/mockUser";
import {
  createSnippetIncident,
  useSnippetSites,
  type IncidentSeverity,
} from "@/lib/pm/snippetIncidents";
import type { Snippet } from "@/lib/pm/snippets";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snippet: Snippet;
  onCreated?: (incidentId: string) => void;
}

const SEVERITIES: { value: IncidentSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function ReportBrokenSnippetDialog({ open, onOpenChange, snippet, onCreated }: Props) {
  const users = useMockUsers();
  const qc = useQueryClient();
  const { data: sites, isLoading } = useSnippetSites(snippet.id, open);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("high");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [assignees, setAssignees] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(`${snippet.title} broken`);
    setDescription("");
    setSeverity("high");
    setAssignees({});
  }, [open, snippet.title]);

  useEffect(() => {
    if (!sites) return;
    setSelected(prev => {
      const next: Record<string, boolean> = { ...prev };
      sites.forEach(s => {
        if (next[s.projectId] === undefined) next[s.projectId] = true;
      });
      return next;
    });
  }, [sites]);

  const selectedCount = useMemo(
    () => (sites ?? []).filter(s => selected[s.projectId]).length,
    [sites, selected],
  );

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    (sites ?? []).forEach(s => (next[s.projectId] = v));
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (!title.trim() || selectedCount === 0) return;
    setSaving(true);
    try {
      const payload = {
        snippetId: snippet.id,
        snippetTitle: snippet.title,
        title: title.trim(),
        description: description.trim(),
        severity,
        sites: (sites ?? [])
          .filter(s => selected[s.projectId])
          .map(s => ({
            projectId: s.projectId,
            projectTitle: s.projectTitle,
            assigneeId: assignees[s.projectId] ?? null,
          })),
      };
      const { incident } = await createSnippetIncident(payload);
      qc.invalidateQueries({ queryKey: ["snippet-usage", snippet.id] });
      qc.invalidateQueries({ queryKey: ["snippet-incident-active", snippet.id] });
      qc.invalidateQueries({ queryKey: ["snippet-incidents-all"] });
      toast.success(`Created ${payload.sites.length} follow-up task${payload.sites.length === 1 ? "" : "s"}`);
      onCreated?.(incident.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create incident");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Report broken snippet
          </DialogTitle>
          <DialogDescription>
            Creates one trackable task per affected site, all tied to a single incident.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">What's broken?</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Details</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="What's failing, how to reproduce, what the fix should look like."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Copied to every follow-up task as its description.
            </p>
          </div>

          <div>
            <Label className="text-xs">Severity</Label>
            <Select value={severity} onValueChange={v => setSeverity(v as IncidentSeverity)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Affected sites</Label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={() => toggleAll(true)}
                  className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Select all
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => toggleAll(false)}
                  className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-[13px] text-muted-foreground py-6 text-center">Loading sites…</div>
            ) : (sites ?? []).length === 0 ? (
              <div className="text-[13px] text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                This snippet isn't linked to any project tasks yet.
              </div>
            ) : (
              <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-y-auto">
                {(sites ?? []).map(s => {
                  const checked = !!selected[s.projectId];
                  return (
                    <label
                      key={s.projectId}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={v =>
                          setSelected(p => ({ ...p, [s.projectId]: !!v }))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] truncate">{s.projectTitle}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {s.clientName ?? "—"} · {s.openTasks} open task{s.openTasks === 1 ? "" : "s"}
                        </div>
                      </div>
                      <Select
                        value={assignees[s.projectId] ?? "unassigned"}
                        onValueChange={v =>
                          setAssignees(prev => ({
                            ...prev,
                            [s.projectId]: v === "unassigned" ? null : v,
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-xs" onClick={e => e.stopPropagation()}>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || selectedCount === 0}
            className="gap-1.5"
          >
            <AlertTriangle className="h-4 w-4" />
            {saving
              ? "Creating…"
              : `Create ${selectedCount} follow-up task${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

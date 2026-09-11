import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SettingsSubnav } from "@/components/pm/SettingsSubnav";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { canSee } from "@/lib/pm/permissions";
import {
  createMilestoneDefinition,
  deactivateMilestoneDefinition,
  deleteMilestoneDefinition,
  reorderMilestoneDefinitions,
  updateMilestoneDefinition,
  useMilestoneDefinitions,
  countProjectsUsingMilestone,
} from "@/lib/pm/milestones";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";

export default function MilestoneSettings() {
  const { roles } = useCurrentUser();
  const canManage = canSee(roles, "clients"); // PM/BA
  const { data: defs = [], refetch, isLoading } = useMilestoneDefinitions({ includeInactive: true });
  const [newLabel, setNewLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () => [...defs].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key)),
    [defs],
  );

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto page-shell space-y-4">
        <h1 className="text-2xl font-bold">Milestones</h1>
        <p className="text-sm text-muted-foreground">Only PMs and BAs can manage milestone options.</p>
      </div>
    );
  }

  async function onAdd() {
    try {
      await createMilestoneDefinition(newLabel);
      setNewLabel("");
      await refetch();
      toast.success("Milestone added");
    } catch (e: any) {
      toast.error(e.message || "Failed to add");
    }
  }

  async function onSaveLabel(id: string) {
    const label = (editLabels[id] ?? sorted.find((d) => d.id === id)?.label ?? "").trim();
    if (!label) return;
    setBusyId(id);
    try {
      await updateMilestoneDefinition(id, { label });
      setEditLabels((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refetch();
      toast.success("Label saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setBusyId(null);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = sorted.map((d) => d.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setBusyId(id);
    try {
      await reorderMilestoneDefinitions(next);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to reorder");
    } finally {
      setBusyId(null);
    }
  }

  async function onDeactivate(id: string) {
    setBusyId(id);
    try {
      await deactivateMilestoneDefinition(id);
      await refetch();
      toast.success("Milestone deactivated");
    } catch (e: any) {
      toast.error(e.message || "Failed to deactivate");
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(id: string) {
    setBusyId(id);
    try {
      await updateMilestoneDefinition(id, { is_active: true });
      await refetch();
      toast.success("Milestone reactivated");
    } catch (e: any) {
      toast.error(e.message || "Failed to reactivate");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string, key: string) {
    setBusyId(id);
    try {
      const n = await countProjectsUsingMilestone(key);
      if (n > 0) {
        toast.error(`${n} project(s) still use this milestone. Deactivate instead.`);
        return;
      }
      await deleteMilestoneDefinition(id, key);
      await refetch();
      toast.success("Milestone deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto page-shell space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Milestones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Project lifecycle options used across lists, timeline, and reporting. Separate from task phases.
        </p>
      </div>
      <SettingsSubnav current="milestones" />

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Add milestone</div>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Discovery"
            onKeyDown={(e) => { if (e.key === "Enter") void onAdd(); }}
          />
          <Button onClick={() => void onAdd()} disabled={!newLabel.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && sorted.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No milestones yet.</p>
        )}
        {sorted.map((d, idx) => {
          const draft = editLabels[d.id] ?? d.label;
          const dirty = draft.trim() !== d.label;
          return (
            <div key={d.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={idx === 0 || busyId === d.id}
                  onClick={() => void move(d.id, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={idx === sorted.length - 1 || busyId === d.id}
                  onClick={() => void move(d.id, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 min-w-[180px] space-y-1">
                <Input
                  value={draft}
                  onChange={(e) => setEditLabels((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="h-8"
                />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <code className="rounded bg-muted px-1">{d.key}</code>
                  {!d.is_active && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {dirty && (
                  <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void onSaveLabel(d.id)}>
                    Save
                  </Button>
                )}
                {d.is_active ? (
                  <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => void onDeactivate(d.id)}>
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => void onReactivate(d.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Reactivate
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busyId === d.id}
                  onClick={() => void onDelete(d.id, d.key)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Layers, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPageGroups, fetchProjectReservations,
  removePageFromProject, RESERVED_PREFIX, getGroupsAwaitingPages,
  type PageGroup, type AwaitingGroup,
} from "@/lib/pm/pageGroups";
import type { PmTask } from "@/types/pm";
import { AddPageDialog } from "./AddPageDialog";
import { emitTasksChanged, useTasksChanged } from "@/lib/pm/refresh";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { toast } from "sonner";

export function PagesTab({
  projectId, templateId, tasks,
}: { projectId: string; templateId: string | null; tasks: PmTask[] }) {
  const [groups, setGroups] = useState<PageGroup[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [awaiting, setAwaiting] = useState<AwaitingGroup[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitialGroupId, setAddInitialGroupId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ key: string; label: string } | null>(null);

  const reload = async () => {
    if (!templateId) { setGroups([]); setReservations([]); setAwaiting([]); return; }
    const [g, r, a] = await Promise.all([
      fetchPageGroups(templateId),
      fetchProjectReservations(projectId),
      getGroupsAwaitingPages(projectId, templateId, tasks as any),
    ]);
    setGroups(g); setReservations(r); setAwaiting(a);
  };
  useEffect(() => { reload(); }, [templateId, projectId, tasks]);
  useTasksChanged(reload);

  const openAddFor = (groupId: string | null) => {
    setAddInitialGroupId(groupId);
    setAddOpen(true);
  };

  if (!templateId) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">This project wasn't created from a template, so page groups aren't available.</CardContent></Card>;
  }
  if (!groups.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No page groups defined in this template. Add one in the template editor.</CardContent></Card>;
  }

  const awaitingIds = new Set(awaiting.map(a => a.group.id));

  // For each group: count actual pages (distinct page_group_key not starting with reserved:)
  const groupSummaries = groups.map(g => {
    const groupResTasks = reservations.filter(r => r.page_group_key === `${RESERVED_PREFIX}${g.id}`);
    const pageKeys = new Set(
      tasks
        .filter(t => (t as any).page_group_key && !String((t as any).page_group_key).startsWith(RESERVED_PREFIX))
        // Match by checking if any reservation links — we use heuristic: page_label set, key not reserved.
        .map(t => (t as any).page_group_key as string),
    );
    // Best effort: pages that belong to this group are those whose first slot task type matches one of group's slots — but we lack that link in live tasks.
    // For now show: total reserved days by phase + defined-pages count via heuristic on page_label not "[Reserved]".
    const definedPages = Array.from(new Set(
      tasks
        .filter(t => (t as any).page_label && !String((t as any).page_label).startsWith("[Reserved]"))
        .map(t => (t as any).page_label as string),
    ));
    const reservedByPhase: Record<string, number> = {};
    for (const r of groupResTasks) {
      // resolve phase via phase_id → name
      const phaseRow = null; // we'd need phases — skip name; group by id
      const key = r.phase_id || "Unphased";
      reservedByPhase[key] = (reservedByPhase[key] || 0) + (r.duration_days || 0);
    }
    return { g, groupResTasks, definedPages, reservedByPhase };
  });

  async function removePage(pageKey: string, label: string) {
    await removePageFromProject(projectId, pageKey);
    toast.success(`Removed "${label}"`);
    emitTasksChanged();
  }

  // Pages list (across all groups, distinct page_group_key)
  const definedPages = Object.values(
    tasks
      .filter(t => (t as any).page_group_key && !String((t as any).page_group_key).startsWith(RESERVED_PREFIX))
      .reduce<Record<string, { key: string; label: string; count: number }>>((acc, t: any) => {
        const k = t.page_group_key;
        if (!acc[k]) acc[k] = { key: k, label: t.page_label || "Untitled", count: 0 };
        acc[k].count++;
        return acc;
      }, {}),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-semibold">Pages</div>
        </div>
        <Button size="sm" onClick={() => openAddFor(null)}>
          <Plus className="h-3 w-3 mr-1" /> Add pages
        </Button>
      </div>

      {awaiting.length > 0 && (
        <div className="rounded-md border border-amber-500/60 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Discovery complete — time to define pages</div>
              <p className="text-muted-foreground text-xs mt-0.5">
                {awaiting.length === 1
                  ? `The discovery task for "${awaiting[0].group.name}" is done. Define the pages so the reserved time turns into real work.`
                  : `${awaiting.length} page groups are ready to be defined now that discovery is complete.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-6">
            {awaiting.map(a => (
              <Button key={a.group.id} size="sm" variant="outline" onClick={() => openAddFor(a.group.id)}>
                Define {a.group.name} pages
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {groupSummaries.map(({ g, groupResTasks, reservedByPhase }) => {
          const totalReserved = Object.values(reservedByPhase).reduce((a, b) => a + b, 0);
          const expected = g.expected_page_count ?? 5;
          // Best-effort defined count for this group: any page_label whose key contains the group id prefix
          const definedForGroup = definedPages.filter(p => p.key.startsWith(g.id.slice(0, 6))).length;
          const pct = Math.min(100, Math.round((definedForGroup / Math.max(1, expected)) * 100));
          return (
            <Card key={g.id} className={awaitingIds.has(g.id) ? "border-amber-500/60" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="font-medium truncate">{g.name}</div>
                    {awaitingIds.has(g.id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 shrink-0">
                        Ready to define
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {definedForGroup} / {expected} pages
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-info" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Parallel cap: {g.parallel_cap ?? 3} · {groupResTasks.length} reservation block(s) totalling {totalReserved}d remaining
                </div>
                {groupResTasks.length > 0 && totalReserved === 0 && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    Reservation exhausted. Adding more pages will push the schedule.
                  </div>
                )}
                {awaitingIds.has(g.id) && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => openAddFor(g.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Define pages
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-xs uppercase text-muted-foreground">Defined pages</div>
          {definedPages.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No pages defined yet. Reserved time is held in the schedule until you add them.</div>
          ) : (
            <ul className="divide-y divide-border">
              {definedPages.map(p => (
                <li key={p.key} className="flex items-center justify-between py-1.5 text-sm">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground">{p.count} task(s)</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setPendingRemoval({ key: p.key, label: p.label })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddPageDialog
        projectId={projectId}
        templateId={templateId}
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setAddInitialGroupId(null); }}
        initialGroupId={addInitialGroupId}
      />

      <ConfirmDialog
        open={!!pendingRemoval}
        onOpenChange={(o) => { if (!o) setPendingRemoval(null); }}
        title="Remove this page?"
        description={pendingRemoval ? `All tasks for "${pendingRemoval.label}" will be deleted. This cannot be undone.` : undefined}
        confirmLabel="Remove page"
        onConfirm={async () => {
          if (!pendingRemoval) return;
          await removePage(pendingRemoval.key, pendingRemoval.label);
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}

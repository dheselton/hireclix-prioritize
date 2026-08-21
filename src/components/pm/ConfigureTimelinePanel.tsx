import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Unlock, AlertTriangle } from "lucide-react";
import { fetchTasks, fetchDependencies, applyScheduleDiffs } from "@/lib/pm/api";
import { scheduleForwardFromKickoff, fitToWindow } from "@/lib/pm/scheduler";
import { supabase } from "@/integrations/supabase/client";
import { CascadeConfirmModal } from "@/components/pm/CascadeConfirmModal";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";
import type { PmTask, PmDependency, PmProject } from "@/types/pm";

export function ConfigureTimelinePanel({
  project, open, onOpenChange, onApplied,
}: {
  project: PmProject;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied?: () => void;
}) {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [deps, setDeps] = useState<PmDependency[]>([]);
  const [kickoff, setKickoff] = useState<string>(project.kickoff_date || project.start_date || "");
  const [goLive, setGoLive] = useState<string>(project.go_live_date || "");
  const [pendingDiffs, setPendingDiffs] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warning, setWarning] = useState<{ earliestGoLive: string; offendingTasks: { id: string; title: string }[] } | null>(null);

  const reload = async () => {
    const [t, d] = await Promise.all([fetchTasks(project.id), fetchDependencies(project.id)]);
    setTasks(t); setDeps(d);
  };
  useEffect(() => { if (open) { reload(); setKickoff(project.kickoff_date || project.start_date || ""); setGoLive(project.go_live_date || ""); } }, [open, project.id]);

  function patchLocal(id: string, p: Partial<PmTask>) {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...p } : t));
  }
  async function persistTask(id: string, p: Partial<PmTask>) {
    await supabase.from("pm_tasks").update(p as any).eq("id", id);
  }
  const taskTitle = (id: string) => tasks.find(t => t.id === id)?.title || "—";
  const incomingDeps = useMemo(() => {
    const m = new Map<string, PmDependency[]>();
    for (const d of deps) {
      if (!m.has(d.task_id)) m.set(d.task_id, []);
      m.get(d.task_id)!.push(d);
    }
    return m;
  }, [deps]);
  function patchDepLag(depId: string, lag: number) {
    setDeps(deps.map(d => d.id === depId ? { ...d, lag_days: lag } : d));
  }
  async function persistDepLag(depId: string, lag: number) {
    await supabase.from("pm_task_dependencies").update({ lag_days: lag }).eq("id", depId);
  }

  async function autoLinkInOrder() {
    if (deps.length && !confirm(`This project already has ${deps.length} dependencies. Replace them with an auto-generated chain?`)) return;
    // Sort tasks by phase sort_order, then task sort_order
    const phaseOrder = new Map<string | null, number>();
    phaseGroups.forEach(([pid], i) => phaseOrder.set(pid, i));
    const ordered = [...tasks].sort((a, b) => {
      const pa = phaseOrder.get(a.phase_id) ?? 999;
      const pb = phaseOrder.get(b.phase_id) ?? 999;
      if (pa !== pb) return pa - pb;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    const newDeps = [];
    for (let i = 1; i < ordered.length; i++) {
      newDeps.push({
        task_id: ordered[i].id,
        depends_on_task_id: ordered[i - 1].id,
        type: "finish_start",
        lag_days: 0,
      });
    }
    if (deps.length) {
      await supabase.from("pm_task_dependencies").delete().in("id", deps.map(d => d.id));
    }
    if (newDeps.length) {
      const { error } = await supabase.from("pm_task_dependencies").insert(newDeps as any);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`Linked ${newDeps.length} dependencies in order`);
    await reload();
  }

  function recalcFromKickoff() {
    if (!kickoff) return toast.error("Set a kickoff date first");
    if (!deps.length) {
      toast.error("No dependencies yet — click \"Auto-link tasks in order\" first, or add dependencies in the task editor.");
      return;
    }
    const r = scheduleForwardFromKickoff(kickoff, tasks, deps);
    setGoLive(r.suggestedGoLive);
    setWarning(null);
    if (!r.diffs.length) { toast.success("Schedule already up to date"); return; }
    setPendingDiffs(r.diffs);
    setConfirmOpen(true);
  }
  function recalcFromGoLive() {
    if (!kickoff || !goLive) return toast.error("Set both kickoff and go-live dates");
    if (!deps.length) {
      toast.error("No dependencies yet — click \"Auto-link tasks in order\" first, or add dependencies in the task editor.");
      return;
    }
    const r = fitToWindow(kickoff, goLive, tasks, deps);
    setWarning(r.warning ?? null);
    if (!r.diffs.length) { toast.success("Schedule already fits the window"); return; }
    setPendingDiffs(r.diffs);
    setConfirmOpen(true);
  }

  function diagnose() {
    const noDates = tasks.filter(t => !t.start_date || !t.due_date).length;
    toast.message("Timeline diagnosis", {
      description:
        `Tasks: ${tasks.length} (${noDates} missing dates) · ` +
        `Dependencies: ${deps.length} · ` +
        `Kickoff: ${kickoff || "not set"} · ` +
        `Go-live: ${goLive || "not set"}`,
    });
  }

  async function onConfirm() {
    await applyScheduleDiffs(pendingDiffs);
    await supabase.from("pm_projects").update({ kickoff_date: kickoff, start_date: kickoff, go_live_date: goLive } as any).eq("id", project.id);
    toast.success("Timeline updated");
    setPendingDiffs([]);
    onOpenChange(false);
    onApplied?.();
  }

  const phaseGroups = useMemo(() => {
    const m = new Map<string | null, PmTask[]>();
    for (const t of tasks) {
      const k = t.phase_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return Array.from(m.entries());
  }, [tasks]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto safe-bottom">
          <SheetHeader><SheetTitle>Configure Timeline</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kickoff date</Label>
                <Input type="date" value={kickoff} onChange={e => setKickoff(e.target.value)} />
              </div>
              <div>
                <Label>Go-live date</Label>
                <Input type="date" value={goLive} onChange={e => setGoLive(e.target.value)} />
              </div>
            </div>

            <div className="border border-border rounded">
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <div className="col-span-6">Task</div>
                <div className="col-span-2">Days</div>
                <div className="col-span-2">Min</div>
                <div className="col-span-2 text-center">Lock</div>
              </div>
              {phaseGroups.map(([phaseId, phaseTasks]) => (
                <div key={String(phaseId)}>
                  {phaseTasks.map(t => {
                    const deps = incomingDeps.get(t.id) || [];
                    return (
                    <div key={t.id} className="flex flex-col gap-2 md:grid md:grid-cols-12 md:gap-2 px-3 py-2 md:items-start border-t border-border">
                      <div className="md:col-span-6 flex flex-col gap-1 text-sm min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className="truncate">{t.title}</span>
                        </div>
                        {deps.map(dep => (
                          <div key={dep.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-4 flex-wrap">
                            <span>← {taskTitle(dep.depends_on_task_id)}</span>
                            <span>+</span>
                            <Input type="number" min={0} className="h-5 w-12 text-[11px] px-1.5 py-0"
                              value={dep.lag_days ?? 0}
                              onChange={e => patchDepLag(dep.id, Number(e.target.value))}
                              onBlur={e => persistDepLag(dep.id, Number(e.target.value))} />
                            <span>d wait</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2 md:contents">
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Days</Label>
                          <Input type="number" className="h-8" value={t.duration_days}
                            disabled={t.locked}
                            onChange={e => patchLocal(t.id, { duration_days: Number(e.target.value) })}
                            onBlur={e => persistTask(t.id, { duration_days: Number(e.target.value) })} />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground md:hidden">Min</Label>
                          <div className="text-xs text-muted-foreground h-8 flex items-center">{t.min_duration_days ?? "—"}</div>
                        </div>
                        <div className="md:col-span-2 flex md:justify-center items-end md:items-start">
                          <Label className="text-[10px] uppercase text-muted-foreground md:hidden sr-only">Lock</Label>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
                            if (t.locked && !confirm("Unlock this task? Its minimum duration will no longer be enforced.")) return;
                            patchLocal(t.id, { locked: !t.locked });
                            persistTask(t.id, { locked: !t.locked });
                          }}>
                            {t.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={recalcFromKickoff}>Recalculate from Kickoff</Button>
              <Button onClick={recalcFromGoLive}>Recalculate from Go-Live</Button>
              <Button variant="ghost" onClick={autoLinkInOrder} title="Create finish→start dependencies in current sort order. Useful for legacy projects that have no dependency graph.">
                Auto-link tasks in order
              </Button>
              <Button variant="ghost" size="sm" onClick={diagnose} className="ml-auto">
                Diagnose timeline
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CascadeConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        diffs={pendingDiffs}
        goLiveDate={goLive}
        onConfirm={onConfirm}
      />
      {warning && confirmOpen && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm p-3 bg-amber-500/10 border border-amber-500/40 rounded text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Timeline too tight</div>
            <div className="text-muted-foreground">Earliest possible go-live: <strong>{fmtDate(warning.earliestGoLive)}</strong></div>
          </div>
        </div>
      )}
    </>
  );
}

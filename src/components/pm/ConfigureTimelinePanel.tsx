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

  function recalcFromKickoff() {
    if (!kickoff) return toast.error("Set a kickoff date first");
    const r = scheduleForwardFromKickoff(kickoff, tasks, deps);
    setGoLive(r.suggestedGoLive);
    setWarning(null);
    setPendingDiffs(r.diffs);
    setConfirmOpen(true);
  }
  function recalcFromGoLive() {
    if (!kickoff || !goLive) return toast.error("Set both kickoff and go-live dates");
    const r = fitToWindow(kickoff, goLive, tasks, deps);
    setWarning(r.warning ?? null);
    setPendingDiffs(r.diffs);
    setConfirmOpen(true);
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
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
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
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
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
                    <div key={t.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-start border-t border-border">
                      <div className="col-span-6 flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-1.5">
                          {t.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                          <span className="truncate">{t.title}</span>
                        </div>
                        {deps.map(dep => (
                          <div key={dep.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-4">
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
                      <Input type="number" className="col-span-2 h-8" value={t.duration_days}
                        disabled={t.locked}
                        onChange={e => patchLocal(t.id, { duration_days: Number(e.target.value) })}
                        onBlur={e => persistTask(t.id, { duration_days: Number(e.target.value) })} />
                      <div className="col-span-2 text-xs text-muted-foreground">{t.min_duration_days ?? "—"}</div>
                      <div className="col-span-2 flex justify-center">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
                          if (t.locked && !confirm("Unlock this task? Its minimum duration will no longer be enforced.")) return;
                          patchLocal(t.id, { locked: !t.locked });
                          persistTask(t.id, { locked: !t.locked });
                        }}>
                          {t.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={recalcFromKickoff}>Recalculate from Kickoff</Button>
              <Button onClick={recalcFromGoLive}>Recalculate from Go-Live</Button>
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock, AlertTriangle, ArrowRight, Rocket } from "lucide-react";
import { fetchTemplateBundle, buildPreviewFromTemplate, createProjectFromTemplate, type PreviewTask } from "@/lib/pm/api";
import { scheduleForwardFromKickoff, fitToWindow, type ScheduleDep } from "@/lib/pm/scheduler";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

export function TimelineSetupWizard({
  templateId, open, onOpenChange,
}: { templateId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<any>(null);
  const [tasks, setTasks] = useState<PreviewTask[]>([]);
  const [deps, setDeps] = useState<ScheduleDep[]>([]);
  const [kickoff, setKickoff] = useState<string>("");
  const [goLive, setGoLive] = useState<string>("");
  const [goLiveTouched, setGoLiveTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateId) return;
    setStep(1); setGoLiveTouched(false);
    setKickoff(new Date().toISOString().slice(0, 10));
    (async () => {
      const b = await fetchTemplateBundle(templateId);
      setTemplate(b.template);
      const built = buildPreviewFromTemplate(b.tasks, b.deps);
      setTasks(built.previewTasks);
      setDeps(built.previewDeps);
    })();
  }, [open, templateId]);

  // Suggested go-live whenever kickoff changes (only auto-fill if user hasn't touched it)
  const suggested = useMemo(() => {
    if (!kickoff || !tasks.length) return null;
    return scheduleForwardFromKickoff(kickoff, tasks as any, deps);
  }, [kickoff, tasks, deps]);

  useEffect(() => {
    if (suggested && !goLiveTouched) setGoLive(suggested.suggestedGoLive);
  }, [suggested, goLiveTouched]);

  // Fit-to-window placement based on current kickoff + goLive
  const fit = useMemo(() => {
    if (!kickoff || !goLive || !tasks.length) return null;
    return fitToWindow(kickoff, goLive, tasks as any, deps);
  }, [kickoff, goLive, tasks, deps]);

  const placement = fit?.placement ?? suggested?.placement ?? new Map();
  const warning = fit?.warning;

  // Group preview tasks by phase for the mini Gantt
  const phases = useMemo(() => {
    const out = new Map<string, PreviewTask[]>();
    for (const t of tasks) {
      const k = t.phase_name || "Other";
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(t);
    }
    return Array.from(out.entries());
  }, [tasks]);

  const minDate = useMemo(() => {
    if (!placement.size) return null;
    let m: Date | null = null;
    placement.forEach(p => { if (!m || p.start < m) m = p.start; });
    return m;
  }, [placement]);
  const maxDate = useMemo(() => {
    if (!placement.size) return null;
    let m: Date | null = null;
    placement.forEach(p => { if (!m || p.end > m) m = p.end; });
    return m;
  }, [placement]);
  const totalDays = minDate && maxDate ? Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000) + 1) : 1;

  async function confirm() {
    if (!template || !fit) return;
    setLoading(true);
    try {
      const proj = await createProjectFromTemplate({
        template,
        previewTasks: tasks,
        previewDeps: deps,
        placement: fit.placement,
        kickoff,
        goLive,
      });
      toast.success("Project created");
      onOpenChange(false);
      navigate(`/pm/projects/${proj.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create project from {template?.name || "template"} — Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <Label>Kickoff date</Label>
            <Input type="date" value={kickoff} onChange={e => setKickoff(e.target.value)} className="w-56" />
            <p className="text-xs text-muted-foreground">All tasks will be scheduled forward from this date using template durations.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded border border-border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Based on your kickoff date of {fmtDate(kickoff)}</div>
              <div className="text-base font-medium mt-1">Suggested go-live: {fmtDate(suggested?.suggestedGoLive)}</div>
            </div>
            <div>
              <Label>Or choose your own go-live</Label>
              <Input type="date" value={goLive} onChange={e => { setGoLive(e.target.value); setGoLiveTouched(true); }} className="w-56" />
            </div>
            {warning && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/40 rounded text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Timeline too tight</div>
                  <div className="text-muted-foreground">
                    This compresses {warning.offendingTasks.slice(0, 3).map(t => t.title).join(", ")}
                    {warning.offendingTasks.length > 3 ? `, +${warning.offendingTasks.length - 3} more` : ""} below their minimum duration.
                  </div>
                  <div className="mt-1">Suggested earliest go-live: <strong>{fmtDate(warning.earliestGoLive)}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Kickoff <strong className="text-foreground">{fmtDate(kickoff)}</strong> → Go-live <strong className="text-foreground">{fmtDate(goLive)}</strong> ({totalDays} days)
            </div>
            <div className="max-h-[420px] overflow-auto border border-border rounded">
              {phases.map(([phaseName, phaseTasks]) => (
                <div key={phaseName} className="border-b border-border last:border-b-0">
                  <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold uppercase tracking-wide">{phaseName}</div>
                  {phaseTasks.map(t => {
                    const p = placement.get(t.temp_id);
                    if (!p || !minDate) return null;
                    const offsetDays = Math.round((p.start.getTime() - minDate.getTime()) / 86400000);
                    const left = (offsetDays / totalDays) * 100;
                    const w = Math.max(2, (p.duration / totalDays) * 100);
                    return (
                      <div key={t.temp_id} className="grid grid-cols-[260px_1fr] items-center px-3 py-1.5 gap-3 hover:bg-muted/20">
                        <div className="flex items-center gap-1.5 text-sm">
                          {t.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                          <span className="truncate">{t.title}</span>
                        </div>
                        <div className="relative h-5 bg-muted/30 rounded">
                          <div
                            className={`absolute h-full rounded ${t.locked ? "bg-primary/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,hsl(var(--background)/0.25)_3px,hsl(var(--background)/0.25)_5px)]" : "bg-primary/80"}`}
                            style={{ left: `${left}%`, width: `${w}%` }}
                            title={`${fmtDate(p.start.toISOString().slice(0,10))} → ${fmtDate(p.end.toISOString().slice(0,10))} (${p.duration}d)`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex gap-3">
                <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span>
                <span>Diagonal pattern = locked task at minimum duration</span>
              </div>
              <div>Gaps between bars include realistic client-scheduling time (typically 3–5 days). Adjust per-task in Configure Timeline after creating the project.</div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>Back</Button>}
          {step < 3 && (
            <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={step === 1 ? !kickoff : !goLive}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={confirm} disabled={loading || !fit}>
              <Rocket className="h-4 w-4 mr-1" /> Confirm & Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

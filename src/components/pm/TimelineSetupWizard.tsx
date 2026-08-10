import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle, ArrowRight, Rocket, FileText } from "lucide-react";
import { fetchTemplateBundle, buildPreviewFromTemplate, createProjectFromTemplate, type PreviewTask } from "@/lib/pm/api";
import { fetchPageGroups, expandPageGroupsInTemplate, type PageGroup } from "@/lib/pm/pageGroups";
import { scheduleForwardFromKickoff, fitToWindow, type ScheduleDep } from "@/lib/pm/scheduler";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";

type Step = 1 | 2;

export function TimelineSetupWizard({
  templateId, open, onOpenChange,
}: { templateId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<any>(null);
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [rawDeps, setRawDeps] = useState<any[]>([]);
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([]);
  const [tasks, setTasks] = useState<PreviewTask[]>([]);
  const [deps, setDeps] = useState<ScheduleDep[]>([]);
  const [kickoff, setKickoff] = useState<string>("");
  const [goLive, setGoLive] = useState<string>("");
  const [goLiveTouched, setGoLiveTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasPageGroups = pageGroups.length > 0;
  const totalSteps = 2;

  useEffect(() => {
    if (!open || !templateId) return;
    setStep(1); setGoLiveTouched(false);
    setKickoff(new Date().toISOString().slice(0, 10));
    (async () => {
      const [b, pg] = await Promise.all([
        fetchTemplateBundle(templateId),
        fetchPageGroups(templateId),
      ]);
      setTemplate(b.template);
      setRawTasks(b.tasks);
      setRawDeps(b.deps);
      setPageGroups(pg);
    })();
  }, [open, templateId]);

  // Rebuild preview whenever selection changes — pass groups so reservations get stamped
  useEffect(() => {
    if (!rawTasks.length) { setTasks([]); setDeps([]); return; }
    const expanded = expandPageGroupsInTemplate({
      templateTasks: rawTasks, templateDeps: rawDeps, selectedPages: [], groups: pageGroups,
    });
    const built = buildPreviewFromTemplate(expanded.tasks, expanded.deps);
    setTasks(built.previewTasks);
    setDeps(built.previewDeps);
  }, [rawTasks, rawDeps, pageGroups]);

  const suggested = useMemo(() => {
    if (!kickoff || !tasks.length) return null;
    return scheduleForwardFromKickoff(kickoff, tasks as any, deps);
  }, [kickoff, tasks, deps]);

  useEffect(() => {
    if (suggested && !goLiveTouched) setGoLive(suggested.suggestedGoLive);
  }, [suggested, goLiveTouched]);

  const fit = useMemo(() => {
    if (!kickoff || !goLive || !tasks.length) return null;
    return fitToWindow(kickoff, goLive, tasks as any, deps);
  }, [kickoff, goLive, tasks, deps]);

  const placement = fit?.placement ?? suggested?.placement ?? new Map();
  const warning = fit?.warning;

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
  /** Whole/half weeks between two ISO dates, phrased for humans. */
  const weeksBetween = (from: string, to: string | undefined | null) => {
    if (!from || !to) return null;
    const days = Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
    if (days < 0) return null;
    const weeks = days / 7;
    const rounded = Math.round(weeks * 2) / 2;
    return { days, label: `${rounded} ${rounded === 1 ? "week" : "weeks"}` };
  };
  const suggestedWeeks = weeksBetween(kickoff, suggested?.suggestedGoLive);
  const chosenWeeks = weeksBetween(kickoff, goLive);
  const earliestWeeks = weeksBetween(kickoff, warning?.earliestGoLive);

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

  // Steps: 1 = dates (kickoff + go-live together), 2 = review. Pages are never
  // chosen here — the BA defines them after Discovery from the Pages tab.
  const showDates = step === 1;
  const showReview = step === 2;

  const canAdvance = !!kickoff && !!goLive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Create project from {template?.name || "template"} — {showDates ? "Dates" : "Review"} (step {step} of {totalSteps})
          </DialogTitle>
        </DialogHeader>

        {showDates && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Kickoff date</Label>
                <Input type="date" value={kickoff} onChange={e => setKickoff(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">All tasks schedule forward from here.</p>
              </div>
              <div>
                <Label>Go-live date</Label>
                <Input type="date" value={goLive} onChange={e => { setGoLive(e.target.value); setGoLiveTouched(true); }} className="mt-1" />
                {chosenWeeks && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {chosenWeeks.label} from kickoff ({chosenWeeks.days} days)
                    {suggestedWeeks && chosenWeeks.days !== suggestedWeeks.days
                      ? ` · ${chosenWeeks.days < suggestedWeeks.days ? "shorter" : "longer"} than suggested`
                      : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded border border-border p-3 bg-muted/30 flex items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Based on your kickoff date of {fmtDate(kickoff)}</div>
                <div className="text-base font-medium mt-1">
                  Suggested go-live: {fmtDate(suggested?.suggestedGoLive)}
                  {suggestedWeeks && (
                    <span className="text-muted-foreground font-normal"> — {suggestedWeeks.label} ({suggestedWeeks.days} days)</span>
                  )}
                </div>
              </div>
              {suggested && goLive !== suggested.suggestedGoLive && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => { setGoLive(suggested.suggestedGoLive); setGoLiveTouched(false); }}
                >
                  Use suggested
                </Button>
              )}
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
                  <div className="mt-1">
                    Suggested earliest go-live: <strong>{fmtDate(warning.earliestGoLive)}</strong>
                    {earliestWeeks && <span className="text-muted-foreground"> — {earliestWeeks.label} from kickoff</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showReview && (
          <div className="space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <Label className="text-xs">Kickoff</Label>
                <Input type="date" value={kickoff} onChange={e => setKickoff(e.target.value)} className="mt-1 h-8 w-40" />
              </div>
              <div>
                <Label className="text-xs">Go-live</Label>
                <Input
                  type="date"
                  value={goLive}
                  onChange={e => { setGoLive(e.target.value); setGoLiveTouched(true); }}
                  className="mt-1 h-8 w-40"
                />
              </div>
              <div className="text-sm text-muted-foreground pb-1.5">
                {chosenWeeks ? `${chosenWeeks.label}, ` : ""}{totalDays} days · {tasks.length} tasks
              </div>
            </div>
            {hasPageGroups && (
              <div className="rounded border border-info/40 bg-info/5 p-3 flex items-start gap-2">
                <FileText className="h-4 w-4 text-info mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">Pages are defined after Discovery.</span>{" "}
                  Time is reserved now across every phase your page work touches
                  ({pageGroups.map(g => g.name).join(", ")}). A <strong className="text-foreground">Define pages</strong> task
                  will be created for the BA — once they list the real pages, each one stamps out its full
                  concept / design / build / QA bundle and consumes the reserved time.
                </div>
              </div>
            )}
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
                            className={`absolute h-full rounded ${t.locked ? "bg-primary/60" : "bg-primary/80"}`}
                            style={{ left: `${left}%`, width: `${w}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>Back</Button>}
          {!showReview && (
            <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canAdvance}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {showReview && (
            <Button onClick={confirm} disabled={loading || !fit}>
              <Rocket className="h-4 w-4 mr-1" /> Confirm & Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

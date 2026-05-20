import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, AlertTriangle, ArrowRight, Rocket, Plus, X } from "lucide-react";
import { fetchTemplateBundle, buildPreviewFromTemplate, createProjectFromTemplate, type PreviewTask } from "@/lib/pm/api";
import { fetchPageGroups, fetchPagePresets, expandPageGroupsInTemplate, type PageGroup, type PagePreset, type SelectedPage } from "@/lib/pm/pageGroups";
import { scheduleForwardFromKickoff, fitToWindow, type ScheduleDep } from "@/lib/pm/scheduler";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4;

export function TimelineSetupWizard({
  templateId, open, onOpenChange,
}: { templateId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<any>(null);
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [rawDeps, setRawDeps] = useState<any[]>([]);
  const [pageGroups, setPageGroups] = useState<PageGroup[]>([]);
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [selectedPages, setSelectedPages] = useState<SelectedPage[]>([]);
  const [customName, setCustomName] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<PreviewTask[]>([]);
  const [deps, setDeps] = useState<ScheduleDep[]>([]);
  const [kickoff, setKickoff] = useState<string>("");
  const [goLive, setGoLive] = useState<string>("");
  const [goLiveTouched, setGoLiveTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasPageGroups = pageGroups.length > 0;
  const [pickPagesNow, setPickPagesNow] = useState(false);
  const totalSteps: 3 | 4 = hasPageGroups ? 4 : 3;

  useEffect(() => {
    if (!open || !templateId) return;
    setStep(1); setGoLiveTouched(false);
    setKickoff(new Date().toISOString().slice(0, 10));
    setSelectedPages([]);
    setCustomName({});
    setPickPagesNow(false);
    (async () => {
      const [b, pg, pp] = await Promise.all([
        fetchTemplateBundle(templateId),
        fetchPageGroups(templateId),
        fetchPagePresets(templateId),
      ]);
      setTemplate(b.template);
      setRawTasks(b.tasks);
      setRawDeps(b.deps);
      setPageGroups(pg);
      setPresets(pp);
    })();
  }, [open, templateId]);

  // Rebuild preview whenever selection changes — pass groups so reservations get stamped
  useEffect(() => {
    if (!rawTasks.length) { setTasks([]); setDeps([]); return; }
    const expanded = expandPageGroupsInTemplate({
      templateTasks: rawTasks, templateDeps: rawDeps, selectedPages, groups: pageGroups,
    });
    const built = buildPreviewFromTemplate(expanded.tasks, expanded.deps);
    setTasks(built.previewTasks);
    setDeps(built.previewDeps);
  }, [rawTasks, rawDeps, selectedPages, pageGroups]);

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
  const totalDays = minDate && maxDate ? Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000) + 1) : 1;

  function togglePreset(groupId: string, preset: PagePreset) {
    const key = `${groupId}_${preset.id}`;
    setSelectedPages(prev => {
      const exists = prev.find(p => p.key === key);
      if (exists) return prev.filter(p => p.key !== key);
      return [...prev, { key, page_group_id: groupId, page_label: preset.name }];
    });
  }

  function addCustomPage(groupId: string) {
    const name = (customName[groupId] || "").trim();
    if (!name) return;
    const key = `${groupId}_custom_${Date.now()}`;
    setSelectedPages(prev => [...prev, { key, page_group_id: groupId, page_label: name }]);
    setCustomName(c => ({ ...c, [groupId]: "" }));
  }

  function removePage(key: string) {
    setSelectedPages(prev => prev.filter(p => p.key !== key));
  }

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

  // Step ordering: 1=kickoff, 2=pages info OR picker, 3=goLive, 4=review
  // When no page groups: 1=kickoff, 2=goLive, 3=review
  const showPagesInfo = step === 2 && hasPageGroups;
  const showPagesStep = showPagesInfo && pickPagesNow;
  const showGoLive = (hasPageGroups && step === 3) || (!hasPageGroups && step === 2);
  const showReview = (hasPageGroups && step === 4) || (!hasPageGroups && step === 3);

  const canAdvance = step === 1 ? !!kickoff
    : showPagesInfo ? true
    : showGoLive ? !!goLive
    : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create project from {template?.name || "template"} — Step {step} of {totalSteps}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <Label>Kickoff date</Label>
            <Input type="date" value={kickoff} onChange={e => setKickoff(e.target.value)} className="w-56" />
            <p className="text-xs text-muted-foreground">All tasks will be scheduled forward from this date.</p>
          </div>
        )}

        {showPagesInfo && !pickPagesNow && (
          <div className="space-y-4">
            <div className="rounded border border-info/40 bg-info/5 p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">Pages will be defined after Discovery</div>
              <p className="text-xs text-muted-foreground">
                We'll reserve time across <strong>every phase your page tasks touch</strong> (Design, Build, QA, etc.)
                based on each group's expected page count and parallel cap. Once Discovery wraps and you know the real pages,
                add them from the project's <strong>Pages</strong> tab — added tasks consume the reserved time automatically.
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 pt-1">
                {pageGroups.map(g => (
                  <li key={g.id}>
                    <strong className="text-foreground">{g.name}</strong> — reserving for ~{g.expected_page_count ?? 5} page(s), {g.parallel_cap ?? 3} in parallel
                  </li>
                ))}
              </ul>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={pickPagesNow} onCheckedChange={(v) => setPickPagesNow(!!v)} />
              I already know the pages — let me pick them now
            </label>
          </div>
        )}
        {showPagesStep && (
          <div className="space-y-4 max-h-[460px] overflow-auto">
            <p className="text-xs text-muted-foreground">
              Pick which pages this project needs. Each selected page stamps out the full task bundle (design, dev, QA, etc.) and schedules them in parallel.
            </p>
            {pageGroups.map(g => {
              const groupPresets = presets.filter(p => p.page_group_id === g.id);
              const selectedHere = selectedPages.filter(s => s.page_group_id === g.id);
              return (
                <div key={g.id} className="border border-border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{g.name}</div>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {selectedHere.length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {groupPresets.map(p => {
                      const key = `${g.id}_${p.id}`;
                      const on = selectedPages.some(s => s.key === key);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePreset(g.id, p)}
                          className={`h-7 px-2.5 rounded-full text-xs border transition ${on ? "bg-info/10 text-info border-info" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                  {selectedHere.filter(s => !groupPresets.some(p => `${g.id}_${p.id}` === s.key)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedHere.filter(s => !groupPresets.some(p => `${g.id}_${p.id}` === s.key)).map(s => (
                        <span key={s.key} className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full text-xs bg-info/10 text-info border border-info">
                          {s.page_label}
                          <button type="button" onClick={() => removePage(s.key)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Custom page name…"
                      value={customName[g.id] || ""}
                      onChange={e => setCustomName(c => ({ ...c, [g.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomPage(g.id); } }}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={() => addCustomPage(g.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="text-xs text-muted-foreground border-t border-border pt-2">
              Total pages selected: <strong className="text-foreground">{selectedPages.length}</strong> · Total tasks in project: <strong className="text-foreground">{tasks.length}</strong>
            </div>
          </div>
        )}

        {showGoLive && (
          <div className="space-y-4">
            <div className="rounded border border-border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Based on your kickoff date of {fmtDate(kickoff)} and {selectedPages.length} page(s)</div>
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

        {showReview && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Kickoff <strong className="text-foreground">{fmtDate(kickoff)}</strong> → Go-live <strong className="text-foreground">{fmtDate(goLive)}</strong> ({totalDays} days) · {tasks.length} tasks
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

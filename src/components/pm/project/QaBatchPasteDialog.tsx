import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ListPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { QA_SEVERITIES, assertTaskKind, type QaSeverity } from "@/lib/pm/taskKind";

/** Validated at module load so a typo fails loudly, not silently. */
const QA_KIND = assertTaskKind("qa");
import { toast } from "sonner";
import type { PmProject, TaskPriority } from "@/types/pm";

interface Row {
  title: string;
  severity: QaSeverity;
  environment: string;
  reporter: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: PmProject;
  onCreated?: () => void;
}

/** Split pasted text into ticket rows. Accepts one-per-line, numbered
 *  lists, bulleted lists, or tab/comma-separated "Title, Severity, Page". */
function parsePaste(raw: string, defaultSeverity: QaSeverity, defaultEnv: string): Row[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    // strip leading list markers: "1.", "1)", "-", "*", "•"
    const cleaned = line.replace(/^(\d+[.)]|[-*•])\s+/, "").trim();
    // Try TSV / CSV: Title[TAB|,] Severity [TAB|,] Environment
    const parts = cleaned.split(/\t|,(?=\s*(?:blocker|major|minor|cosmetic|http|www)\b)/i);
    let title = parts[0]?.trim() ?? cleaned;
    let severity = defaultSeverity;
    let environment = defaultEnv;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].trim();
      const lower = p.toLowerCase();
      if (QA_SEVERITIES.includes(lower as QaSeverity)) {
        severity = lower as QaSeverity;
      } else if (p) {
        environment = p;
      }
    }
    if (!title) title = cleaned;
    return { title, severity, environment, reporter: "" };
  });
}

const SEVERITY_TO_PRIORITY: Record<QaSeverity, TaskPriority> = {
  blocker: "urgent",
  major: "high",
  minor: "medium",
  cosmetic: "low",
};

export function QaBatchPasteDialog({ open, onOpenChange, project, onCreated }: Props) {
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [raw, setRaw] = useState("");
  const [defaultSeverity, setDefaultSeverity] = useState<QaSeverity>("major");
  const [defaultEnv, setDefaultEnv] = useState("");
  const [defaultReporter, setDefaultReporter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => parsePaste(raw, defaultSeverity, defaultEnv), [raw, defaultSeverity, defaultEnv]);

  function reset() {
    setStep("paste"); setRaw(""); setRows([]); setSaving(false);
  }

  function goReview() {
    if (preview.length === 0) { toast.error("Paste at least one line"); return; }
    setRows(preview.map(r => ({ ...r, reporter: defaultReporter })));
    setStep("review");
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const uid = getCurrentUserId();
      const payload = rows.map(r => ({
        project_id: project.id,
        title: r.title.slice(0, 500),
        type: "qa" as const,
        status: "unclaimed" as const,
        priority: SEVERITY_TO_PRIORITY[r.severity],
        assignee_id: null,
        created_by: uid ?? null,
        tags: ["qa"],
        custom_fields: {
          kind: QA_KIND,
          qa: {
            severity: r.severity,
            environment: r.environment || null,
            reported_by_name: r.reporter || null,
          },
        },
      }));
      const { error } = await supabase.from("pm_tasks").insert(payload as any);
      if (error) throw error;
      toast.success(`Created ${rows.length} QA ticket${rows.length === 1 ? "" : "s"}`);
      emitTasksChanged();
      onCreated?.();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create tickets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" /> Log QA batch
          </DialogTitle>
          <DialogDescription>
            Paste a list of client-reported issues (one per line). Each becomes a QA ticket you can triage.
          </DialogDescription>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Default severity</Label>
                <Select value={defaultSeverity} onValueChange={(v) => setDefaultSeverity(v as QaSeverity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QA_SEVERITIES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Environment / URL</Label>
                <Input value={defaultEnv} onChange={(e) => setDefaultEnv(e.target.value)} placeholder="staging.example.com" />
              </div>
              <div className="space-y-1">
                <Label>Reporter (client name)</Label>
                <Input value={defaultReporter} onChange={(e) => setDefaultReporter(e.target.value)} placeholder="e.g. Jane at Acme" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Paste tickets — one per line</Label>
              <Textarea
                rows={10}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={`Header logo is blurry on mobile\nContact form 500 error, blocker, /contact\nSpelling: "Recieve" on About page, cosmetic`}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tip: add <code className="bg-muted px-1">, blocker</code> or a URL to override defaults per line.
              </p>
            </div>
            {preview.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Detected <span className="font-semibold text-foreground">{preview.length}</span> ticket{preview.length === 1 ? "" : "s"}.
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <div className="text-xs text-muted-foreground">Review and edit before creating. All tickets start as <span className="font-medium">New</span> (unclaimed).</div>
            <div className="border border-border rounded-md divide-y divide-border">
              <div className="grid grid-cols-[1fr_140px_180px_160px_32px] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
                <div>Title</div><div>Severity</div><div>Environment</div><div>Reporter</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_180px_160px_32px] gap-2 px-3 py-2 items-center">
                  <Input value={r.title} onChange={(e) => updateRow(i, { title: e.target.value })} className="h-8 text-sm" />
                  <Select value={r.severity} onValueChange={(v) => updateRow(i, { severity: v as QaSeverity })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QA_SEVERITIES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={r.environment} onChange={(e) => updateRow(i, { environment: e.target.value })} className="h-8 text-sm" placeholder="URL / browser" />
                  <Input value={r.reporter} onChange={(e) => updateRow(i, { reporter: e.target.value })} className="h-8 text-sm" placeholder="Reporter" />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(i)} title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "paste" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={goReview} disabled={preview.length === 0}>
                Review {preview.length || ""} ticket{preview.length === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("paste")} disabled={saving}>Back</Button>
              <Button onClick={submit} disabled={saving || rows.length === 0}>
                {saving ? "Creating…" : `Create ${rows.length} ticket${rows.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

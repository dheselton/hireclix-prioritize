import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId, useMockUsers } from "@/lib/pm/mockUser";
import { emitTasksChanged } from "@/lib/pm/refresh";
import {
  downloadTaskCsvTemplate,
  parseTaskCsv,
  type TaskImportRow,
} from "@/lib/pm/csvImport";
import { toast } from "sonner";
import type { PmPhase, PmProject } from "@/types/pm";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: PmProject;
  phases: PmPhase[];
  onCreated?: () => void;
}

export function TasksCsvImportDialog({ open, onOpenChange, project, phases, onCreated }: Props) {
  const users = useMockUsers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<TaskImportRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setSaving(false);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTaskCsv(text, { phases, users });
      if (parsed.length === 0) {
        toast.error("No tasks found — check the header row matches the template");
        return;
      }
      setFileName(file.name);
      setRows(parsed);
      toast.success(`Loaded ${parsed.length} task${parsed.length === 1 ? "" : "s"} from CSV`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not read CSV");
    }
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    const valid = rows.filter(r => !r.error && r.title.trim());
    if (valid.length === 0) {
      toast.error("Fix row errors before importing");
      return;
    }
    setSaving(true);
    try {
      const uid = getCurrentUserId();
      const payload = valid.map(r => {
        const hasAssignee = !!r.assigneeId;
        return {
          project_id: project.id,
          title: r.title.slice(0, 500),
          description: r.description?.trim() || null,
          type: r.type,
          status: hasAssignee ? ("claimed" as const) : ("unclaimed" as const),
          priority: r.priority,
          assignee_id: r.assigneeId,
          created_by: uid ?? null,
          creation_source: "csv_import",
          creation_context: {},
          phase_id: r.phaseId,
          start_date: r.startDate,
          due_date: r.dueDate,
          duration_days: r.durationDays,
          teams: r.teams,
          tags: r.tags,
        };
      });
      const { error } = await supabase.from("pm_tasks").insert(payload as any);
      if (error) throw error;
      const skipped = rows.length - valid.length;
      toast.success(
        skipped > 0
          ? `Created ${valid.length} task${valid.length === 1 ? "" : "s"} (${skipped} skipped)`
          : `Created ${valid.length} task${valid.length === 1 ? "" : "s"}`,
      );
      emitTasksChanged();
      onCreated?.();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create tasks");
    } finally {
      setSaving(false);
    }
  }

  const readyCount = rows.filter(r => !r.error).length;
  const errorCount = rows.filter(r => r.error).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import tasks from CSV
          </DialogTitle>
          <DialogDescription>
            Download the template, fill it in a spreadsheet, then upload. Phase names and assignee emails are matched when possible.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadTaskCsvTemplate()}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download CSV template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {fileName && (
            <span className="text-xs text-muted-foreground truncate max-w-[220px]">{fileName}</span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No file loaded yet. Use the template so columns line up — common header aliases are also accepted
            (e.g. <code className="bg-muted px-1">Due</code> for <code className="bg-muted px-1">Due date</code>).
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {errorCount > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                {errorCount} row{errorCount === 1 ? "" : "s"} have issues and will be skipped unless you remove them.
              </div>
            )}
            <div className="border border-border rounded-md divide-y divide-border text-sm">
              <div className="grid grid-cols-[1.4fr_90px_90px_1fr_1fr_32px] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
                <div>Title</div><div>Type</div><div>Priority</div><div>Phase</div><div>Assignee</div><div></div>
              </div>
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[1.4fr_90px_90px_1fr_1fr_32px] gap-2 px-3 py-2 items-start ${r.error ? "bg-destructive/5" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    {r.error && <p className="text-[10px] text-destructive mt-0.5">{r.error}</p>}
                  </div>
                  <div className="capitalize text-muted-foreground">{r.type}</div>
                  <div className="capitalize text-muted-foreground">{r.priority}</div>
                  <div className="truncate text-muted-foreground">{r.phaseLabel || "—"}</div>
                  <div className="truncate text-muted-foreground">{r.assigneeLabel || "Unassigned"}</div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(i)} title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || readyCount === 0}>
            {saving ? "Importing…" : `Import ${readyCount || ""} task${readyCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchTemplateBundle, buildPreviewFromTemplate, convertRequestToProject, logActivity,
} from "@/lib/pm/api";
import { scheduleForwardFromKickoff, fitToWindow } from "@/lib/pm/scheduler";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  userId?: string | null;
  onConverted?: () => void;
}

export function ConvertToProjectModal({ open, onOpenChange, projectId, userId, onConverted }: Props) {
  const [templates, setTemplates] = useState<{ id: string; name: string; type: string }[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [kickoff, setKickoff] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [goLive, setGoLive] = useState<string>("");
  const [goLiveTouched, setGoLiveTouched] = useState(false);
  const [bundle, setBundle] = useState<{ template: any; previewTasks: any[]; previewDeps: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("pm_project_templates").select("id,name,type").order("name");
      setTemplates((data as any) || []);
    })();
  }, [open]);

  useEffect(() => {
    if (!templateId) { setBundle(null); return; }
    (async () => {
      const b = await fetchTemplateBundle(templateId);
      const built = buildPreviewFromTemplate(b.tasks, b.deps);
      setBundle({ template: b.template, previewTasks: built.previewTasks, previewDeps: built.previewDeps });
    })();
  }, [templateId]);

  const suggested = useMemo(() => {
    if (!kickoff || !bundle?.previewTasks.length) return null;
    return scheduleForwardFromKickoff(kickoff, bundle.previewTasks as any, bundle.previewDeps);
  }, [kickoff, bundle]);

  useEffect(() => {
    if (suggested && !goLiveTouched) setGoLive(suggested.suggestedGoLive);
  }, [suggested, goLiveTouched]);

  const fit = useMemo(() => {
    if (!kickoff || !goLive || !bundle?.previewTasks.length) return null;
    return fitToWindow(kickoff, goLive, bundle.previewTasks as any, bundle.previewDeps);
  }, [kickoff, goLive, bundle]);

  async function confirm() {
    if (!bundle || !fit) return;
    setLoading(true);
    try {
      await convertRequestToProject({
        projectId,
        template: bundle.template,
        previewTasks: bundle.previewTasks as any,
        previewDeps: bundle.previewDeps as any,
        placement: fit.placement,
        kickoff,
        goLive,
      });
      await logActivity({
        project_id: projectId, user_id: userId ?? null,
        action: "project.converted_to_project",
        payload: { template_id: bundle.template?.id },
      });
      toast.success("Converted to project");
      onOpenChange(false);
      onConverted?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to convert");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convert to Project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Kickoff date</Label>
              <Input type="date" value={kickoff} onChange={e => setKickoff(e.target.value)} />
            </div>
            <div>
              <Label>Go-live date</Label>
              <Input type="date" value={goLive} onChange={e => { setGoLive(e.target.value); setGoLiveTouched(true); }} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Existing request tasks are preserved at the top of the task list. Template phases and tasks will be added below.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={loading || !templateId || !kickoff || !goLive || !fit}>
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

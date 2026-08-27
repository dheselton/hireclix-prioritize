import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientSelect } from "@/components/pm/ClientSelect";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { supabase } from "@/integrations/supabase/client";
import { updateProject, setProjectRequester } from "@/lib/pm/api";
import { applyClientWatchers } from "@/lib/pm/clientWatchers";
import { TagPicker } from "@/components/pm/tags/TagPicker";
import { clientTag } from "@/lib/pm/tags";
import { toast } from "sonner";
import type { PmProject, ProjectStatus, WorkType } from "@/types/pm";

type Client = { id: string; name: string; is_internal?: boolean };

const STATUSES: ProjectStatus[] = ["draft", "active", "on_hold", "in_review", "complete", "archived"];
const WORK_TYPES: WorkType[] = ["project", "request"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: PmProject;
  onSaved?: () => void;
}

export function EditProjectDialog({ open, onOpenChange, project, onSaved }: Props) {
  const [title, setTitle] = useState(project.title);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [workType, setWorkType] = useState<WorkType>(project.work_type);
  const [clientId, setClientId] = useState<string>(project.client_id ?? "");
  const [requestedBy, setRequestedBy] = useState<string | null>((project as any).requested_by ?? null);
  const [goLive, setGoLive] = useState<string>(project.go_live_date ?? "");
  const [kickoff, setKickoff] = useState<string>(project.kickoff_date ?? "");
  const [startDate, setStartDate] = useState<string>(project.start_date ?? "");
  const [description, setDescription] = useState<string>(project.description ?? "");
  const [tags, setTags] = useState<string[]>(project.tags ?? []);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset form when project changes / dialog reopens
  useEffect(() => {
    if (!open) return;
    setTitle(project.title);
    setStatus(project.status);
    setWorkType(project.work_type);
    setClientId(project.client_id ?? "");
    setRequestedBy((project as any).requested_by ?? null);
    setGoLive(project.go_live_date ?? "");
    setKickoff(project.kickoff_date ?? "");
    setStartDate(project.start_date ?? "");
    setDescription(project.description ?? "");
    setTags(project.tags ?? []);
  }, [open, project]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("clients").select("id, name, is_internal").order("name");
      setClients((data as any[]) ?? []);
    })();
  }, [open]);

  const goLiveChanged = (project.go_live_date ?? "") !== goLive;

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const nextClient = clientId || null;
      const clientChanged = (project.client_id ?? null) !== nextClient;
      // Refresh the client:<slug> tag when the client changes
      let nextTags = tags;
      if (clientChanged) {
        const nonClient = tags.filter(t => !t.startsWith("client:"));
        const c = clients.find(x => x.id === nextClient);
        const ct = clientTag(c?.name);
        nextTags = ct ? [...nonClient, ct] : nonClient;
      }
      await updateProject(project.id, {
        title: title.trim(),
        status,
        work_type: workType,
        client_id: nextClient,
        go_live_date: goLive || null,
        kickoff_date: kickoff || null,
        start_date: startDate || null,
        description: description.trim() || null,
        tags: nextTags,
      } as any);
      if ((project as any).requested_by !== requestedBy) {
        await setProjectRequester(project.id, requestedBy);
      }
      if (clientChanged && nextClient) {
        await applyClientWatchers(project.id, nextClient, null);
      }
      toast.success("Project updated");
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update the project's core details. Task dates won't shift automatically — open Timeline to recalculate.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Work type</Label>
              <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {WORK_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Client</Label>
            <ClientSelect
              value={clientId}
              onChange={setClientId}
              clients={clients}
              onClientsChanged={(next) => setClients(next)}
            />
          </div>

          <RequesterPicker
            value={requestedBy}
            onChange={setRequestedBy}
            label={workType === "request" ? "Submitter" : "Requested by"}
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start date</Label>
              <DatePicker value={startDate} onChange={v => setStartDate(v ?? "")} className="w-full" />
            </div>
            <div>
              <Label>Kickoff</Label>
              <DatePicker value={kickoff} onChange={v => setKickoff(v ?? "")} className="w-full" />
            </div>
            <div>
              <Label>Go-live</Label>
              <DatePicker value={goLive} onChange={v => setGoLive(v ?? "")} className="w-full" />
            </div>
          </div>
          {goLiveChanged && (
            <p className="text-xs text-muted-foreground -mt-2">
              Go-live changed — task dates won't shift automatically. Open Timeline to recalculate.
            </p>
          )}

          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <Label>Tags</Label>
            <div className="rounded-md border border-input bg-background px-2 py-1.5 min-h-9">
              <TagPicker value={tags} onChange={setTags} editableNamespaces={["feature", "type"]} placeholder="Tag" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Client tag updates automatically when you change client.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

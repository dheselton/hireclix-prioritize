import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientSelect } from "@/components/pm/ClientSelect";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { GroupedRequestTypeSelect } from "@/components/pm/intake/GroupedRequestTypeSelect";
import { supabase } from "@/integrations/supabase/client";
import { updateProject, setProjectRequester } from "@/lib/pm/api";
import { applyClientWatchers } from "@/lib/pm/clientWatchers";
import { TagPicker } from "@/components/pm/tags/TagPicker";
import { clientTag } from "@/lib/pm/tags";
import {
  fetchLiveCareerSites,
  isInSupportMode,
  type LiveSiteSummary,
} from "@/lib/pm/liveSites";
import {
  correctRequestType,
  isCareerSiteRequestType,
} from "@/lib/pm/requestCorrections";
import { toast } from "sonner";
import type { RequestType } from "@/lib/pm/requestTypes";
import type { PmProject, ProjectStatus, WorkType } from "@/types/pm";

type Client = { id: string; name: string; is_internal?: boolean };

const STATUSES: ProjectStatus[] = ["draft", "active", "on_hold", "in_review", "complete", "archived"];
const WORK_TYPES: WorkType[] = ["project", "request"];
const RETIRE_STATUSES = new Set<ProjectStatus>(["complete", "archived"]);
const NO_SITE = "__none__";

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
  const [requestType, setRequestType] = useState<RequestType | "">(
    ((project.custom_fields as { request_type?: string } | null)?.request_type as RequestType) ?? "",
  );
  const [parentProjectId, setParentProjectId] = useState<string>(project.parent_project_id ?? NO_SITE);
  const [liveSites, setLiveSites] = useState<LiveSiteSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmRetireOpen, setConfirmRetireOpen] = useState(false);

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
    setRequestType(
      ((project.custom_fields as { request_type?: string } | null)?.request_type as RequestType) ?? "",
    );
    setParentProjectId(project.parent_project_id ?? NO_SITE);
    setConfirmRetireOpen(false);
  }, [open, project]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("clients").select("id, name, is_internal").order("name");
      setClients((data as any[]) ?? []);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || workType !== "request") return;
    let cancelled = false;
    void fetchLiveCareerSites().then((sites) => {
      if (!cancelled) setLiveSites(sites);
    });
    return () => {
      cancelled = true;
    };
  }, [open, workType]);

  const goLiveChanged = (project.go_live_date ?? "") !== goLive;
  const retiringLiveSite =
    isInSupportMode(project) &&
    !RETIRE_STATUSES.has(project.status) &&
    RETIRE_STATUSES.has(status);
  const isRequest = workType === "request";
  const careerTypeSelected = isCareerSiteRequestType(requestType || null);

  async function persist() {
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

      const prevType =
        (project.custom_fields as { request_type?: string } | null)?.request_type ?? "";
      const typeChanged = isRequest && requestType && requestType !== prevType;
      const nextParent =
        isRequest && careerTypeSelected && parentProjectId !== NO_SITE
          ? parentProjectId
          : null;
      const parentChanged =
        isRequest && (project.parent_project_id ?? null) !== nextParent;

      if (typeChanged || (isRequest && parentChanged && careerTypeSelected)) {
        await correctRequestType({
          requestId: project.id,
          requestType: (requestType || "general") as RequestType,
          parentProjectId: nextParent,
          normalizeClient: true,
        });
      } else if (isRequest && !careerTypeSelected && project.parent_project_id) {
        await updateProject(project.id, { parent_project_id: null } as any);
      }

      // Re-read tags if correctRequestType may have normalized client
      let tagsToSave = nextTags;
      if (typeChanged || parentChanged) {
        const { data: refreshed } = await supabase
          .from("pm_projects")
          .select("tags, client_id")
          .eq("id", project.id)
          .maybeSingle();
        if (refreshed) {
          tagsToSave = (refreshed as any).tags ?? nextTags;
          if ((refreshed as any).client_id) {
            setClientId((refreshed as any).client_id);
          }
        }
      }

      await updateProject(project.id, {
        title: title.trim(),
        status,
        work_type: workType,
        client_id: clientId || null,
        go_live_date: goLive || null,
        kickoff_date: kickoff || null,
        start_date: startDate || null,
        description: description.trim() || null,
        tags: tagsToSave,
      } as any);

      if ((project as any).requested_by !== requestedBy) {
        await setProjectRequester(project.id, requestedBy);
      }
      if (clientChanged && nextClient) {
        await applyClientWatchers(project.id, nextClient, requestType || null);
      }
      toast.success(
        retiringLiveSite
          ? "Site retired — removed from Live Career Sites"
          : "Project updated",
      );
      setConfirmRetireOpen(false);
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update project");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (isRequest && !requestType) {
      toast.error("Request type is required");
      return;
    }
    if (retiringLiveSite) {
      setConfirmRetireOpen(true);
      return;
    }
    await persist();
  }

  const selectedSite = liveSites.find((s) => s.id === parentProjectId);
  const siteClientMismatch =
    careerTypeSelected &&
    selectedSite?.client_id &&
    clientId &&
    selectedSite.client_id !== clientId;

  return (
    <>
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
                {isInSupportMode(project) && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    This is a Live Career Site. Use Support mode for handoff — Complete/Archived retires it from Live Career Sites.
                  </p>
                )}
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

            {isRequest && (
              <div>
                <Label>Request type *</Label>
                <GroupedRequestTypeSelect
                  value={requestType}
                  onChange={(v) => {
                    setRequestType(v);
                    if (!isCareerSiteRequestType(v)) setParentProjectId(NO_SITE);
                  }}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Changing away from Career Site Support removes this from live-site Support queues.
                </p>
              </div>
            )}

            <div>
              <Label>Client</Label>
              <ClientSelect
                value={clientId}
                onChange={setClientId}
                clients={clients}
                onClientsChanged={(next) => setClients(next)}
              />
            </div>

            {isRequest && careerTypeSelected && (
              <div>
                <Label>Live career site</Label>
                <Select value={parentProjectId} onValueChange={setParentProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select live career site…" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover max-h-64">
                    <SelectItem value={NO_SITE}>Not linked</SelectItem>
                    {liveSites.map((s) => {
                      const brand = clients.find((c) => c.id === s.client_id);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {brand?.name ? `${brand.name} — ` : ""}
                          {s.title}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {siteClientMismatch && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    Client on this request differs from the live site&apos;s client. Saving will
                    normalize the request client to match the site.
                  </p>
                )}
              </div>
            )}

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

      <AlertDialog open={confirmRetireOpen} onOpenChange={setConfirmRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire this Live Career Site?</AlertDialogTitle>
            <AlertDialogDescription>
              Marking <span className="font-medium text-foreground">{project.title}</span> as{" "}
              {status.replace(/_/g, " ")} removes it from Live Career Sites and support intake.
              Day-to-day support should stay in Support mode with status Active — only use this when the site is truly retired.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep as Live Site</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                await persist();
              }}
            >
              {saving ? "Saving…" : "Retire site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

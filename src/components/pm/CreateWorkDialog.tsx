import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, FolderKanban, X, Plus, FileText, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createProject, persistIntakeAttachments } from "@/lib/pm/api";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";
import { FormFieldRenderer } from "@/components/pm/forms/FormFieldRenderer";
import { useInternalRequestForm, slugifyLabel, type RequestType } from "@/components/pm/forms/useInternalRequestForm";
import { TimelineSetupWizard } from "@/components/pm/TimelineSetupWizard";
import { ClientSelect } from "@/components/pm/ClientSelect";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { useInternalClientIds, refreshCareerSiteProjects } from "@/lib/pm/clients";
import { Sparkle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  initialStep?: "select" | "request" | "project";
}

type Step = "select" | "request" | "project-entry" | "project-blank";

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  web_edit: "Web edit",
  landing_page: "New landing page",
  careersite_update: "Career site update",
  careersite_bug: "Career site · Bug fix",
  careersite_content: "Career site · Content change",
  careersite_jobfeed: "Career site · API / Job feed",
  careersite_new_page: "Career site · New page",
  careersite_sow: "Career site · SOW project",
  careersite_support: "Career site · General support",
  banner_ads: "Banner ads",
  social: "Social post",
  email: "Email",
  copywriting: "Copywriting",
  job_description: "Job description",
  infographic: "Infographic",
  recruiter_collateral: "Recruiter collateral",
  event_collateral: "Event collateral",
  print_collateral: "Print collateral",
  swag_apparel: "Swag / apparel",
  video_edit: "Video edit",
  photo_retouch: "Photo retouch",
  presentation: "Presentation",
  brand_assets: "Brand assets",
  general: "General",
};

const REQUEST_TYPE_GROUPS: { label: string; types: RequestType[] }[] = [
  { label: "Career Site Support", types: ["careersite_bug", "careersite_content", "careersite_jobfeed", "careersite_new_page", "careersite_sow", "careersite_support"] },
  { label: "Web",                types: ["web_edit", "landing_page", "careersite_update"] },
  { label: "Ads & Campaigns",    types: ["banner_ads", "social", "email"] },
  { label: "Content",            types: ["copywriting", "job_description", "infographic"] },
  { label: "Print & Collateral", types: ["recruiter_collateral", "event_collateral", "print_collateral", "swag_apparel"] },
  { label: "Media",              types: ["video_edit", "photo_retouch", "presentation"] },
  { label: "Brand",              types: ["brand_assets"] },
  { label: "Other",              types: ["general"] },
];

export function CreateWorkDialog({ open, onOpenChange, onCreated, initialStep = "select" }: Props) {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(initialStep === "project" ? "project-entry" : (initialStep as Step));
  const [clients, setClients] = useState<{ id: string; name: string; is_internal?: boolean }[]>([]);
  const internalIds = useInternalClientIds();
  const [templates, setTemplates] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // Request
  const [reqForm, setReqForm] = useState({ title: "", client_id: "", description: "" });
  const [requestType, setRequestType] = useState<RequestType>("web_edit");
  const [reqFieldValues, setReqFieldValues] = useState<Record<string, any>>({});
  const [quickTasks, setQuickTasks] = useState<string[]>([""]);
  const [reqRequestedBy, setReqRequestedBy] = useState<string | null>(null);
  const [reqFiles, setReqFiles] = useState<File[]>([]);
  const [reqLinks, setReqLinks] = useState<StagedLink[]>([]);
  const { formId: internalFormId, fields: internalFields } = useInternalRequestForm(requestType);

  // Project (blank)
  const [projForm, setProjForm] = useState({
    title: "", type: "career_site", status: "active", client_id: "",
    kickoff_date: "", go_live_date: "",
  });
  const [projRequestedBy, setProjRequestedBy] = useState<string | null>(null);
  const [projFiles, setProjFiles] = useState<File[]>([]);
  const [projLinks, setProjLinks] = useState<StagedLink[]>([]);

  // Wizard
  const [wizardTemplateId, setWizardTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(initialStep === "project" ? "project-entry" : (initialStep as Step));
    setReqForm({ title: "", client_id: "", description: "" });
    setRequestType("web_edit");
    setReqFieldValues({});
    setQuickTasks([""]);
    setReqRequestedBy(user?.id ?? null);
    setReqFiles([]); setReqLinks([]);
    setProjForm({ title: "", type: "career_site", status: "active", client_id: "", kickoff_date: "", go_live_date: "" });
    setProjRequestedBy(user?.id ?? null);
    setProjFiles([]); setProjLinks([]);
    (async () => {
      const [{ data: c }, { data: t }] = await Promise.all([
        supabase.from("clients").select("id,name,is_internal").order("name"),
        supabase.from("pm_project_templates").select("id,name,type").order("created_at", { ascending: false }),
      ]);
      setClients(c || []);
      setTemplates(t || []);
    })();
  }, [open, initialStep, user?.id]);

  // Reset answers when request type changes
  useEffect(() => { setReqFieldValues({}); }, [requestType]);

  const requestCustomFields = useMemo(() => {
    const out: Record<string, any> = {};
    internalFields.forEach((f) => {
      const v = reqFieldValues[f.id];
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v) && v.length === 0) return;
      out[slugifyLabel(f.label)] = { label: f.label, type: f.type, value: v };
    });
    return out;
  }, [internalFields, reqFieldValues]);

  async function submitRequest() {
    if (!reqForm.title.trim() || !reqForm.client_id) {
      toast.error("Title and client are required");
      return;
    }
    // Required field validation
    const missing = internalFields.filter((f) => {
      if (!f.required) return false;
      const v = reqFieldValues[f.id];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing.length) {
      toast.error(`Missing required: ${missing.map(m => m.label).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      const proj = await createProject({
        title: reqForm.title.trim(),
        type: "quick_request",
        work_type: "request",
        status: "active",
        client_id: reqForm.client_id,
        description: reqForm.description.trim() || null,
        start_date: new Date().toISOString().slice(0, 10),
        created_by: user?.id ?? null,
        requested_by: reqRequestedBy ?? user?.id ?? null,
        custom_fields: { request_type: requestType, ...requestCustomFields },
      } as any);
      let titles = quickTasks.map(t => t.trim()).filter(Boolean).slice(0, 3);
      if (!titles.length) titles = [reqForm.title.trim()];
      const assigneeForTasks = reqRequestedBy ?? user?.id ?? null;
      // Mirror request description onto each auto-created task so context follows the work.
      const taskDescription = reqForm.description.trim() || null;
      await supabase.from("pm_tasks").insert(titles.map((title, i) => ({
        project_id: proj.id,
        title,
        type: "design",
        status: assigneeForTasks ? "claimed" : "unclaimed",
        priority: "medium",
        duration_days: 1,
        sort_order: i * 10,
        created_by: user?.id ?? null,
        assignee_id: assigneeForTasks,
        description: taskDescription,
      })) as any);

      // Always attach staged files/links at the PROJECT level so every task in the
      // request can see the original assets/refs.
      if (reqFiles.length || reqLinks.length) {
        await persistIntakeAttachments({
          projectId: proj.id,
          taskId: null,
          files: reqFiles,
          links: reqLinks,
          userId: user?.id ?? null,
        });
      }

      // Audit submission
      if (internalFormId) {
        await supabase.from("pm_form_submissions").insert({
          form_id: internalFormId,
          payload: { request_type: requestType, ...requestCustomFields, title: reqForm.title, description: reqForm.description },
          submitter_name: user?.name ?? null,
          submitter_email: user?.email ?? null,
          created_project_id: proj.id,
        } as any);
      }
      // Refresh the Career Site project cache so the new request gets its teal treatment immediately.
      if (typeof requestType === "string" && requestType.startsWith("careersite_")) {
        refreshCareerSiteProjects().catch(() => {});
      }
      toast.success("Request created");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create request");
    } finally {
      setBusy(false);
    }
  }

  async function submitProject() {
    if (!projForm.title.trim()) { toast.error("Title is required"); return; }
    setBusy(true);
    try {
      const proj = await createProject({
        title: projForm.title.trim(),
        type: projForm.type as any,
        work_type: "project",
        status: projForm.status as any,
        client_id: projForm.client_id || null,
        kickoff_date: projForm.kickoff_date || null,
        start_date: projForm.kickoff_date || new Date().toISOString().slice(0, 10),
        go_live_date: projForm.go_live_date || null,
        created_by: user?.id ?? null,
        requested_by: projRequestedBy ?? user?.id ?? null,
      } as any);
      if (projFiles.length || projLinks.length) {
        await persistIntakeAttachments({
          projectId: proj.id,
          taskId: null,
          files: projFiles,
          links: projLinks,
          userId: user?.id ?? null,
        });
      }
      toast.success("Project created");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  function startWizard(templateId: string) {
    onOpenChange(false);
    setTimeout(() => setWizardTemplateId(templateId), 50);
  }

  function gotoNewTemplate() {
    onOpenChange(false);
    navigate("/pm/templates?new=1");
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Create new work"
              : step === "request" ? "New Quick Request"
              : step === "project-entry" ? "New Full Project"
              : "New Blank Project"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button type="button" onClick={() => setStep("request")} className="text-left">
              <Card className="h-full hover:border-primary transition cursor-pointer">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-muted p-2"><Zap className="h-4 w-4" /></div>
                    <div className="font-semibold">Quick Request</div>
                  </div>
                  <p className="text-sm text-muted-foreground">Small tasks, quick turnaround (1–3 tasks).</p>
                </CardContent>
              </Card>
            </button>
            <button type="button" onClick={() => setStep("project-entry")} className="text-left">
              <Card className="h-full hover:border-primary transition cursor-pointer">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-[hsl(var(--role-pm)/0.12)] text-[hsl(var(--role-pm))] p-2"><FolderKanban className="h-4 w-4" /></div>
                    <div className="font-semibold">Full Project</div>
                  </div>
                  <p className="text-sm text-muted-foreground">Multi-phase work with timeline and dependencies.</p>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {step === "request" && (() => {
          const selectedClient = clients.find(c => c.id === reqForm.client_id);
          const isInternal = !!selectedClient && (selectedClient.is_internal || internalIds.has(selectedClient.id));
          return (
          <div className="space-y-3">
            {isInternal && (
              <div className="rounded-md border internal-border-l bg-[hsl(var(--internal)/0.06)] px-3 py-2 flex items-center gap-2">
                <Sparkle className="h-4 w-4 text-[hsl(var(--internal))]" />
                <div className="text-xs">
                  <span className="font-semibold text-[hsl(var(--internal))]">Internal HireClix Request</span>
                  <span className="text-muted-foreground"> — will be color-coded for internal team visibility.</span>
                </div>
              </div>
            )}
            <div>
              <Label>Request type *</Label>
              <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover max-h-[60vh]">
                  {REQUEST_TYPE_GROUPS.map(g => (
                    <SelectGroup key={g.label}>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</SelectLabel>
                      {g.types.map(t => (
                        <SelectItem key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Fields below change based on the request type.</p>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={reqForm.title} onChange={e => setReqForm({ ...reqForm, title: e.target.value })} placeholder="What do you need?" />
            </div>
            <div>
              <Label>Client *</Label>
              <ClientSelect
                value={reqForm.client_id}
                onChange={(id) => setReqForm({ ...reqForm, client_id: id })}
                clients={clients}
                onClientsChanged={(next) => setClients(next)}
              />
            </div>
            <RequesterPicker
              value={reqRequestedBy}
              onChange={setReqRequestedBy}
              label="Requested by"
              helpText="This person will be assigned to the auto-created tasks so they can track updates."
            />

            {/* Conditional fields */}
            {internalFields.length > 0 && (
              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {REQUEST_TYPE_LABELS[requestType]} details
                </div>
                {internalFields.map((f) => (
                  <FormFieldRenderer
                    key={f.id}
                    field={f}
                    value={reqFieldValues[f.id]}
                    onChange={(v) => setReqFieldValues({ ...reqFieldValues, [f.id]: v })}
                  />
                ))}
              </div>
            )}

            <div>
              <Label>Description</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border border-border bg-background p-2 text-sm"
                value={reqForm.description}
                onChange={e => setReqForm({ ...reqForm, description: e.target.value })}
                placeholder="Optional extra context…"
              />
            </div>
            <div>
              <Label>Quick tasks (optional, up to 3)</Label>
              <div className="space-y-1.5 mt-1">
                {quickTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={t}
                      onChange={e => {
                        const next = [...quickTasks]; next[i] = e.target.value; setQuickTasks(next);
                      }}
                      placeholder={`Task ${i + 1}`}
                    />
                    {quickTasks.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => setQuickTasks(quickTasks.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {quickTasks.length < 3 && (
                  <Button size="sm" variant="ghost" onClick={() => setQuickTasks([...quickTasks, ""])}>
                    <Plus className="h-3 w-3 mr-1" /> Add task
                  </Button>
                )}
              </div>
            </div>
            <IntakeAttachmentsField
              files={reqFiles} onFilesChange={setReqFiles}
              links={reqLinks} onLinksChange={setReqLinks}
            />
          </div>
          );
        })()}

        {step === "project-entry" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="border-primary/40">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Rocket className="h-4 w-4 text-primary" /> From Template
                  </div>
                  <p className="text-xs text-muted-foreground">Start from a saved playbook.</p>
                </CardContent>
              </Card>
              <button type="button" onClick={() => setStep("project-blank")} className="text-left">
                <Card className="h-full hover:border-primary transition cursor-pointer">
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <FileText className="h-4 w-4" /> Blank Project
                    </div>
                    <p className="text-xs text-muted-foreground">Manual setup, no template.</p>
                  </CardContent>
                </Card>
              </button>
              <button type="button" onClick={gotoNewTemplate} className="text-left">
                <Card className="h-full hover:border-primary transition cursor-pointer">
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Sparkles className="h-4 w-4" /> New Template
                    </div>
                    <p className="text-xs text-muted-foreground">Build a reusable playbook.</p>
                  </CardContent>
                </Card>
              </button>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Pick a template ({templates.length})
              </div>
              {!templates.length && (
                <div className="text-sm text-muted-foreground italic border border-dashed border-border rounded-md p-4 text-center">
                  No templates yet. Create one or start blank.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
                {templates.map(t => (
                  <button key={t.id} type="button" onClick={() => startWizard(t.id)} className="text-left">
                    <Card className="hover:border-primary transition cursor-pointer">
                      <CardContent className="p-3 space-y-0.5">
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.type}</div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "project-blank" && (
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Client</Label>
              <ClientSelect
                value={projForm.client_id}
                onChange={(id) => setProjForm({ ...projForm, client_id: id })}
                clients={clients}
                onClientsChanged={(next) => setClients(next)}
              />
            </div>
            <RequesterPicker
              value={projRequestedBy}
              onChange={setProjRequestedBy}
              label="Requested by"
              helpText="They'll get visibility into project updates even if they aren't the primary worker."
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={projForm.type} onValueChange={v => setProjForm({ ...projForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {PROJECT_TYPES.filter(t => t !== "quick_request").map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={projForm.status} onValueChange={v => setProjForm({ ...projForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Kickoff Date</Label>
                <DatePicker value={projForm.kickoff_date} onChange={v => setProjForm({ ...projForm, kickoff_date: v ?? "" })} />
              </div>
              <div>
                <Label>Go-Live Date</Label>
                <DatePicker value={projForm.go_live_date} onChange={v => setProjForm({ ...projForm, go_live_date: v ?? "" })} />
              </div>
            </div>
            <IntakeAttachmentsField
              files={projFiles} onFilesChange={setProjFiles}
              links={projLinks} onLinksChange={setProjLinks}
            />
          </div>
        )}

        {step !== "select" && (
          <DialogFooter className={cn("gap-2")}>
            <Button
              variant="outline"
              onClick={() => setStep(step === "project-blank" ? "project-entry" : "select")}
              disabled={busy}
            >Back</Button>
            {step === "request" && <Button onClick={submitRequest} disabled={busy}>Create Request</Button>}
            {step === "project-blank" && <Button onClick={submitProject} disabled={busy}>Create Project</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    <TimelineSetupWizard
      templateId={wizardTemplateId}
      open={!!wizardTemplateId}
      onOpenChange={(v) => { if (!v) { setWizardTemplateId(null); onCreated?.(); } }}
    />
    </>
  );
}

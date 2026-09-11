import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, FolderKanban, X, Plus, FileText, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createProject, persistIntakeAttachments } from "@/lib/pm/api";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/types/pm";
import type { WorkVisibility } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { canCreateWork } from "@/lib/pm/permissions";
import { toast } from "sonner";
import { FormFieldRenderer, isFieldVisible, type FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";
import { useInternalRequestForm, slugifyLabel } from "@/components/pm/forms/useInternalRequestForm";
import { GroupedRequestTypeSelect } from "@/components/pm/intake/GroupedRequestTypeSelect";
import { REQUEST_TYPE_LABELS, isDevRequestType, type RequestType } from "@/lib/pm/requestTypes";

import { TimelineSetupWizard } from "@/components/pm/TimelineSetupWizard";
import { ClientSelect } from "@/components/pm/ClientSelect";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { SubmissionSuccess } from "@/components/pm/intake/SubmissionSuccess";
import { applyClientWatchers } from "@/lib/pm/clientWatchers";
import { aliasFor } from "@/lib/pm/requestAliases";
import { sendRequestReceivedEmail } from "@/lib/pm/requestEmails";
import { useInternalClientIds, resolveDevInternalClientId } from "@/lib/pm/clients";
import { useLiveSitesForClient, resolveParentProjectId } from "@/lib/pm/liveSites";
import { createQuickRequest } from "@/lib/pm/supportQueue";
import { Sparkle } from "lucide-react";
import { fmtDate } from "@/lib/pm/format";
import {
  clearCreateWorkDraft,
  draftHasContent,
  readCreateWorkDraft,
  writeCreateWorkDraft,
  type CreateWorkDraft,
  type CreateWorkDraftStep,
} from "@/lib/pm/createWorkDraft";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  initialStep?: "select" | "request" | "project";
  /** When opening from a client hub, pre-fill empty client fields. */
  presetClientId?: string | null;
}

type Step = CreateWorkDraftStep;

function stepFromInitial(initialStep: "select" | "request" | "project"): Step {
  if (initialStep === "project") return "project-entry";
  return initialStep;
}

/** Which entry point a step belongs to, so we only move the user when they switched sides. */
function stepFamily(step: Step): "select" | "request" | "project" {
  if (step === "request") return "request";
  if (step === "project-entry" || step === "project-blank") return "project";
  return "select";
}

/** Fill client_id only when the form/draft does not already have one. */
function withPresetClient<T extends { client_id: string; visibility?: WorkVisibility }>(form: T, preset: string | null | undefined): T {
  if (!preset || form.client_id) return form;
  return {
    ...form,
    client_id: preset,
    ...("visibility" in form ? { visibility: "client_shared" as WorkVisibility } : {}),
  };
}

export function CreateWorkDialog({
  open,
  onOpenChange,
  onCreated,
  initialStep = "select",
  presetClientId = null,
}: Props) {
  const { user, roles, isAdmin } = useCurrentUser();
  const canCreate = canCreateWork(roles, { isAdmin });
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(stepFromInitial(initialStep));
  const [clients, setClients] = useState<{ id: string; name: string; is_internal?: boolean }[]>([]);
  const internalIds = useInternalClientIds();
  const [templates, setTemplates] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Request
  const [reqForm, setReqForm] = useState({ title: "", client_id: "", description: "" });
  const [requestType, setRequestType] = useState<RequestType>("web_edit");
  const [reqFieldValues, setReqFieldValues] = useState<Record<string, any>>({});
  const [quickTasks, setQuickTasks] = useState<string[]>([""]);
  const [reqRequestedBy, setReqRequestedBy] = useState<string | null>(null);
  const [reqFiles, setReqFiles] = useState<File[]>([]);
  const [reqLinks, setReqLinks] = useState<StagedLink[]>([]);
  const [parentProjectId, setParentProjectId] = useState<string | null>(null);
  const { formId: internalFormId, fields: internalFields } = useInternalRequestForm(requestType);
  const isCareerSiteRequestType = typeof requestType === "string" && requestType.startsWith("careersite_");
  const { sites: liveSites } = useLiveSitesForClient(
    isCareerSiteRequestType && reqForm.client_id ? reqForm.client_id : null,
  );

  // Project (blank)
  const [projForm, setProjForm] = useState<{
    title: string;
    type: string;
    status: string;
    client_id: string;
    kickoff_date: string;
    go_live_date: string;
    visibility: WorkVisibility;
  }>({
    title: "", type: "career_site", status: "active", client_id: "",
    kickoff_date: "", go_live_date: "", visibility: "personal_private",
  });
  const [projRequestedBy, setProjRequestedBy] = useState<string | null>(null);
  const [projFiles, setProjFiles] = useState<File[]>([]);
  const [projLinks, setProjLinks] = useState<StagedLink[]>([]);

  // Wizard
  const [wizardTemplateId, setWizardTemplateId] = useState<string | null>(null);

  // Submission confirmation payload
  const [success, setSuccess] = useState<null | {
    projectId: string;
    requestType: RequestType | null;
    requestTypeLabel: string | null;
    watcherIds: string[];
    alias: string;
    emailSent: boolean | null;
  }>(null);

  const wasOpenRef = useRef(false);
  const skipFieldResetRef = useRef(false);
  const readyToPersistRef = useRef(false);

  function blankDraftSnapshot(nextStep: Step): Omit<CreateWorkDraft, "v" | "userId" | "updatedAt"> {
    const clientId = presetClientId ?? "";
    return {
      step: nextStep,
      requestType: "web_edit",
      reqForm: { title: "", client_id: clientId, description: "" },
      reqFieldValues: {},
      quickTasks: [""],
      reqRequestedBy: user?.id ?? null,
      reqLinks: [],
      parentProjectId: null,
      projForm: {
        title: "",
        type: "career_site",
        status: "active",
        client_id: clientId,
        kickoff_date: "",
        go_live_date: "",
        visibility: clientId ? "client_shared" : "personal_private",
      },
      projRequestedBy: user?.id ?? null,
      projLinks: [],
    };
  }

  function applyDraft(draft: CreateWorkDraft) {
    skipFieldResetRef.current = true;
    setStep(draft.step);
    setRequestType(draft.requestType);
    setReqForm(withPresetClient(draft.reqForm, presetClientId));
    setReqFieldValues(draft.reqFieldValues);
    setQuickTasks(draft.quickTasks.length ? draft.quickTasks : [""]);
    setReqRequestedBy(draft.reqRequestedBy);
    setReqLinks(draft.reqLinks);
    setParentProjectId(draft.parentProjectId);
    setProjForm(withPresetClient(draft.projForm, presetClientId));
    setProjRequestedBy(draft.projRequestedBy);
    setProjLinks(draft.projLinks);
    // Files cannot be restored from sessionStorage after a hard refresh.
    setReqFiles([]);
    setProjFiles([]);
    setSuccess(null);
  }

  function resetToDefaults(nextStep: Step) {
    skipFieldResetRef.current = true;
    const blank = blankDraftSnapshot(nextStep);
    setStep(blank.step);
    setRequestType(blank.requestType);
    setReqForm(blank.reqForm);
    setReqFieldValues({});
    setQuickTasks([""]);
    setReqRequestedBy(blank.reqRequestedBy);
    setReqFiles([]);
    setReqLinks([]);
    setParentProjectId(null);
    setProjForm(blank.projForm);
    setProjRequestedBy(blank.projRequestedBy);
    setProjFiles([]);
    setProjLinks([]);
    setSuccess(null);
  }

  function currentDraftPayload(): Omit<CreateWorkDraft, "v" | "userId" | "updatedAt"> {
    return {
      step,
      requestType,
      reqForm,
      reqFieldValues,
      quickTasks,
      reqRequestedBy,
      reqLinks,
      parentProjectId,
      projForm,
      projRequestedBy,
      projLinks,
    };
  }

  function hasUnsavedWork(): boolean {
    if (success) return false;
    if (reqFiles.length > 0 || projFiles.length > 0) return true;
    return draftHasContent({
      ...currentDraftPayload(),
      v: 1,
      userId: user?.id ?? "anon",
      updatedAt: "",
    });
  }

  async function loadLookups() {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("clients").select("id,name,is_internal").order("name"),
      supabase.from("pm_project_templates").select("id,name,type").order("created_at", { ascending: false }),
    ]);
    setClients(c || []);
    if (presetClientId) {
      const presetClient = (c ?? []).find((client) => client.id === presetClientId);
      setProjForm((previous) => previous.client_id === presetClientId
        ? {
          ...previous,
          visibility: presetClient?.is_internal ? "internal_shared" : "client_shared",
        }
        : previous);
    }
    setTemplates(t || []);
  }

  // Open transition: restore draft / keep in-memory work / start fresh.
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) {
      readyToPersistRef.current = false;
      return;
    }
    if (!justOpened) return;

    void loadLookups();

    const requestedStep = stepFromInitial(initialStep);
    const explicitEntry = initialStep !== "select";

    // Reopening after a submit from an explicit entry point starts a clean form
    // instead of showing the previous confirmation screen.
    if (success) {
      if (explicitEntry) {
        clearCreateWorkDraft(user?.id);
        resetToDefaults(requestedStep);
      }
      readyToPersistRef.current = true;
      return;
    }

    if (hasUnsavedWork()) {
      // Keep the in-memory work, but the button the user clicked decides the step.
      if (explicitEntry && stepFamily(step) !== initialStep) setStep(requestedStep);
      if (presetClientId) {
        setReqForm((prev) => withPresetClient(prev, presetClientId));
        setProjForm((prev) => withPresetClient(prev, presetClientId));
      }
      readyToPersistRef.current = true;
      return;
    }

    const draft = readCreateWorkDraft(user?.id);
    if (draft) {
      applyDraft(
        explicitEntry && stepFamily(draft.step) !== initialStep
          ? { ...draft, step: requestedStep }
          : draft,
      );
      readyToPersistRef.current = true;
      return;
    }

    resetToDefaults(requestedStep);
    readyToPersistRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open transition
  }, [open, initialStep, user?.id, presetClientId]);

  // Autosave serializable fields (not File[]) while the dialog is open.
  useEffect(() => {
    if (!open || !readyToPersistRef.current || success) return;
    writeCreateWorkDraft(user?.id, currentDraftPayload());
  }, [
    open, success, user?.id, step, requestType, reqForm, reqFieldValues, quickTasks,
    reqRequestedBy, reqLinks, parentProjectId, projForm, projRequestedBy, projLinks,
  ]);

  // Reset answers when request type changes (skip during draft restore / blank reset).
  useEffect(() => {
    if (skipFieldResetRef.current) {
      skipFieldResetRef.current = false;
      return;
    }
    setReqFieldValues({});
  }, [requestType]);

  function discardDraftAndClose() {
    clearCreateWorkDraft(user?.id);
    resetToDefaults(stepFromInitial(initialStep));
    setConfirmDiscard(false);
    onOpenChange(false);
  }

  function handleDialogOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    // Closing keeps the draft in sessionStorage + in-memory state so tab switches
    // and navigation do not wipe progress. Explicit discard is separate.
    onOpenChange(false);
  }

  // Dev house tickets default to the Dev Internal client when none is selected yet.
  useEffect(() => {
    if (!isDevRequestType(requestType)) return;
    if (reqForm.client_id) return;
    let cancelled = false;
    void resolveDevInternalClientId().then((id) => {
      if (cancelled || !id) return;
      setReqForm((prev) => (prev.client_id ? prev : { ...prev, client_id: id }));
    });
    return () => { cancelled = true; };
  }, [requestType, reqForm.client_id]);

  // Auto-select unique live site; clear when client/type changes.
  useEffect(() => {
    if (!isCareerSiteRequestType) {
      setParentProjectId(null);
      return;
    }
    if (liveSites.length === 1) setParentProjectId(liveSites[0].id);
    else if (liveSites.length === 0) setParentProjectId(null);
    else setParentProjectId((prev) => (prev && liveSites.some((s) => s.id === prev) ? prev : null));
  }, [isCareerSiteRequestType, liveSites]);

  const valuesBySlug = useMemo(() => {
    const out: Record<string, any> = {};
    for (const f of internalFields as FormFieldRow[]) out[slugifyLabel(f.label)] = reqFieldValues[f.id];
    return out;
  }, [internalFields, reqFieldValues]);

  const visibleInternalFields = useMemo(
    () => (internalFields as FormFieldRow[]).filter((f) => isFieldVisible(f, valuesBySlug)),
    [internalFields, valuesBySlug],
  );

  const requestCustomFields = useMemo(() => {
    const out: Record<string, any> = {};
    visibleInternalFields.forEach((f) => {
      const v = reqFieldValues[f.id];
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v) && v.length === 0) return;
      out[slugifyLabel(f.label)] = { label: f.label, type: f.type, value: v };
    });
    return out;
  }, [visibleInternalFields, reqFieldValues]);

  async function submitRequest() {
    if (!canCreate) {
      toast.error("You don't have permission to create work");
      return;
    }
    if (!reqForm.title.trim() || !reqForm.client_id) {
      toast.error("Title and client are required");
      return;
    }
    // Required field validation — only enforce fields that are currently visible
    // (conditional fields hidden by other answers must not block submit).
    const missing = visibleInternalFields.filter((f) => {
      if (!f.required) return false;
      const v = reqFieldValues[f.id];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing.length) {
      toast.error(`Missing required: ${missing.map(m => m.label).join(", ")}`);
      return;
    }

    let resolvedParent: string | null = null;
    if (isCareerSiteRequestType) {
      const resolved = resolveParentProjectId({ sites: liveSites, selectedId: parentProjectId });
      if (resolved.error) {
        toast.error(resolved.error);
        return;
      }
      resolvedParent = resolved.parentProjectId;
    }

    setBusy(true);
    try {
      const { project: proj, watcherIds } = await createQuickRequest({
        title: reqForm.title.trim(),
        clientId: reqForm.client_id,
        parentProjectId: resolvedParent,
        requestType,
        description: reqForm.description.trim() || null,
        customFields: requestCustomFields,
        requestedBy: reqRequestedBy ?? user?.id ?? null,
        createdBy: user?.id ?? null,
        taskTitles: quickTasks,
        creationSource: "intake",
        creationContext: { request_type: requestType },
      });

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

      // Submit confirmation first so we can audit the outcome on the insert row.
      const selectedClient = clients.find(c => c.id === reqForm.client_id);
      const emailResult = await sendRequestReceivedEmail({
        to: user?.email ?? null,
        title: reqForm.title,
        requestTypeLabel: REQUEST_TYPE_LABELS[requestType] ?? null,
        clientName: selectedClient?.name ?? null,
        projectId: proj.id,
        replyTo: aliasFor(requestType),
      });
      if (user?.email && !emailResult.ok) {
        toast.warning("Request saved, but the confirmation email could not be sent.");
      }

      // Audit submission
      if (internalFormId) {
        await supabase.from("pm_form_submissions").insert({
          form_id: internalFormId,
          payload: { request_type: requestType, ...requestCustomFields, title: reqForm.title, description: reqForm.description },
          submitter_name: user?.name ?? null,
          submitter_email: user?.email ?? null,
          created_project_id: proj.id,
          received_emailed_at: emailResult.ok ? new Date().toISOString() : null,
          received_email_error: emailResult.ok ? null : (emailResult.error ?? "unknown error").slice(0, 500),
        } as any);
      }
      toast.success("Request submitted");
      clearCreateWorkDraft(user?.id);
      setSuccess({
        projectId: proj.id,
        requestType,
        requestTypeLabel: REQUEST_TYPE_LABELS[requestType] ?? null,
        watcherIds,
        alias: aliasFor(requestType),
        emailSent: !!user?.email && emailResult.ok,
      });
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create request");
    } finally {
      setBusy(false);
    }
  }

  async function submitProject() {
    if (!canCreate) {
      toast.error("You don't have permission to create work");
      return;
    }
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
        creation_source: "manual",
        visibility: projForm.client_id && clients.find((c) => c.id === projForm.client_id)?.is_internal
          ? "internal_shared"
          : projForm.visibility,
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
      const watcherIds = await applyClientWatchers(proj.id, projForm.client_id, null).catch(() => []);
      toast.success("Project created");
      clearCreateWorkDraft(user?.id);
      setSuccess({
        projectId: proj.id,
        requestType: null,
        requestTypeLabel: null,
        watcherIds,
        alias: aliasFor(null),
        emailSent: null,
      });
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
    navigate("/pm/templates?newTemplate=1");
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {success ? "Submitted"
              : step === "select" ? "Create new work"
              : step === "request" ? "New Quick Request"
              : step === "project-entry" ? "New Full Project"
              : "New Blank Project"}
          </DialogTitle>
        </DialogHeader>

        {success && (
          <SubmissionSuccess
            requestTypeLabel={success.requestTypeLabel}
            projectId={success.projectId}
            watcherIds={success.watcherIds}
            confirmationAlias={success.alias}
            emailSent={success.emailSent}
          >
            <Button
              onClick={() => {
                const id = success.projectId;
                onOpenChange(false);
                navigate(`/pm/projects/${id}`);
              }}
            >
              Open {success.requestType ? "request" : "project"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(null);
                clearCreateWorkDraft(user?.id);
                resetToDefaults(success.requestType ? "request" : "project-blank");
                readyToPersistRef.current = true;
              }}
            >
              Submit another
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </SubmissionSuccess>
        )}



        {!success && step === "select" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button type="button" onClick={() => setStep("request")} className="text-left">
              <Card className="h-full hover:border-primary transition cursor-pointer">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-muted p-2"><Zap className="h-4 w-4" /></div>
                    <div className="font-semibold">Quick Request</div>
                  </div>
                  <p className="text-sm text-muted-foreground">A lightweight project for small, fast work (1–3 tasks, no timeline).</p>
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
                  <p className="text-sm text-muted-foreground">A multi-phase project with timeline, dependencies, and page groups.</p>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {!success && step === "request" && (() => {
          const selectedClient = clients.find(c => c.id === reqForm.client_id);
          const isInternal = !!selectedClient && (selectedClient.is_internal || internalIds.has(selectedClient.id));
          return (
          <div className="space-y-3">
            {isInternal && (
              <div className="rounded-md border internal-border-l bg-[hsl(var(--internal)/0.06)] px-3 py-2 flex items-center gap-2">
                <Sparkle className="h-4 w-4 text-[hsl(var(--internal))]" />
                <div className="text-xs">
                  <span className="font-semibold text-[hsl(var(--internal))]">Internal request</span>
                  <span className="text-muted-foreground"> — will be color-coded for internal team visibility. Change the client later if this becomes billable.</span>
                </div>
              </div>
            )}
            <div>
              <Label>Request type *</Label>
              <GroupedRequestTypeSelect value={requestType} onChange={setRequestType} />
              <p className="text-xs text-muted-foreground mt-1">
                {isDevRequestType(requestType)
                  ? "Dev tickets default to Dev Internal — override client if this is billable."
                  : "Fields below change based on the request type."}
              </p>
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
            {isCareerSiteRequestType && reqForm.client_id && (
              <div>
                <Label>Live career site{liveSites.length > 1 ? " *" : ""}</Label>
                {liveSites.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    No live career site for this client yet — request will stay unlinked until a site enters Support mode.
                  </p>
                ) : liveSites.length === 1 ? (
                  <p className="text-sm mt-1 text-foreground/90">
                    {liveSites[0].title}
                    {liveSites[0].go_live_date ? (
                      <span className="text-muted-foreground"> · Go-live {fmtDate(liveSites[0].go_live_date)}</span>
                    ) : null}
                  </p>
                ) : (
                  <Select value={parentProjectId ?? undefined} onValueChange={setParentProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select live career site…" />
                    </SelectTrigger>
                    <SelectContent>
                      {liveSites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}{s.go_live_date ? ` · ${fmtDate(s.go_live_date)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
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
                {(() => {
                  const bySlug: Record<string, any> = {};
                  for (const f of internalFields as FormFieldRow[]) bySlug[slugifyLabel(f.label)] = reqFieldValues[f.id];
                  return (internalFields as FormFieldRow[])
                    .filter((f) => isFieldVisible(f, bySlug))
                    .map((f) => (
                      <FormFieldRenderer
                        key={f.id}
                        field={f}
                        value={reqFieldValues[f.id]}
                        onChange={(v) => setReqFieldValues({ ...reqFieldValues, [f.id]: v })}
                      />
                    ));
                })()}

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

        {!success && step === "project-entry" && (
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

        {!success && step === "project-blank" && (
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Client</Label>
              <ClientSelect
                value={projForm.client_id}
                onChange={(id) => {
                  const selected = clients.find((client) => client.id === id);
                  setProjForm({
                    ...projForm,
                    client_id: id,
                    visibility: id
                      ? selected?.is_internal ? "internal_shared" : "client_shared"
                      : "personal_private",
                  });
                }}
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
            <div>
              <Label>Visibility</Label>
              <Select
                value={projForm.visibility}
                onValueChange={(value) => setProjForm({ ...projForm, visibility: value as WorkVisibility })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {projForm.client_id && <SelectItem value="client_shared">Client / Shared</SelectItem>}
                  <SelectItem value="internal_shared">Internal / Shared</SelectItem>
                  {!projForm.client_id && <SelectItem value="personal_private">Personal / Private</SelectItem>}
                </SelectContent>
              </Select>
            </div>
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
                <Label>Proposed Go-Live Date</Label>
                <DatePicker value={projForm.go_live_date} onChange={v => setProjForm({ ...projForm, go_live_date: v ?? "" })} />
              </div>
            </div>
            <IntakeAttachmentsField
              files={projFiles} onFilesChange={setProjFiles}
              links={projLinks} onLinksChange={setProjLinks}
            />
          </div>
        )}

        {!success && step !== "select" && (
          <DialogFooter className={cn("gap-2")}>
            <Button
              variant="ghost"
              className="mr-auto text-muted-foreground"
              onClick={() => setConfirmDiscard(true)}
              disabled={busy || !hasUnsavedWork()}
            >
              Discard draft
            </Button>
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

    <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
          <AlertDialogDescription>
            Your Quick Request / project draft will be cleared. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={discardDraftAndClose}>Discard draft</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <TimelineSetupWizard
      templateId={wizardTemplateId}
      open={!!wizardTemplateId}
      clientId={projForm.client_id || presetClientId || null}
      onOpenChange={(v) => { if (!v) { setWizardTemplateId(null); onCreated?.(); } }}
    />
    </>
  );
}

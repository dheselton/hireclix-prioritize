import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormFieldRenderer, isFieldVisible, type FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";
import { slugifyLabel } from "@/components/pm/forms/useInternalRequestForm";

import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { SubmissionSuccess } from "@/components/pm/intake/SubmissionSuccess";
import { ClientSearchCombobox, type ClientOption } from "@/components/pm/intake/ClientSearchCombobox";
import { GroupedRequestTypeSelect } from "@/components/pm/intake/GroupedRequestTypeSelect";
import { applyClientWatchers } from "@/lib/pm/clientWatchers";
import { aliasFor } from "@/lib/pm/requestAliases";
import { sendRequestReceivedEmail } from "@/lib/pm/requestEmails";
import { createProject, persistIntakeAttachments } from "@/lib/pm/api";
import { REQUEST_TYPE_LABELS, requestTypeLabel, type RequestType } from "@/lib/pm/requestTypes";
import { refreshCareerSiteProjects, useInternalClientIds } from "@/lib/pm/clients";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/pm/format";

const REQUEST_TYPE_SLUG = "request_type";
const TITLE_SLUG = "title";
const SHIP_BY_SLUG = "ship_by_date";
const DESCRIPTION_SLUG = "description";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FormFieldRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestedBy, setRequestedBy] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [clientLocked, setClientLocked] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<StagedLink[]>([]);
  const [submitted, setSubmitted] = useState<null | {
    projectId: string | null;
    watcherIds: string[];
    alias: string;
    requestTypeLabel: string | null;
  }>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const internalIds = useInternalClientIds();

  // Post height to parent so embedding pages can auto-size the iframe.
  useEffect(() => {
    if (!embed) return;
    const post = () => {
      const h = rootRef.current?.scrollHeight ?? document.body.scrollHeight;
      window.parent?.postMessage({ type: "lovable-pm-form", event: "resize", slug, height: h }, "*");
    };
    post();
    const ro = new ResizeObserver(post);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener("load", post);
    return () => { ro.disconnect(); window.removeEventListener("load", post); };
  }, [embed, slug, fields.length, submitted]);

  // Load form + fields + clients
  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("pm_forms").select("*").eq("shareable_slug", slug).maybeSingle();
      if (!f) return;
      setForm(f);
      const [{ data: ff }, { data: c }] = await Promise.all([
        supabase.from("pm_form_fields").select("*").eq("form_id", f.id).order("sort_order"),
        supabase.from("clients").select("id,name,is_internal").order("name"),
      ]);
      setFields((ff || []) as any);
      setClients((c || []) as any);
    })();
  }, [slug]);

  // Resolve ?client=<id|slug> once clients load
  const clientParam = params.get("client");
  useEffect(() => {
    if (!clientParam || !clients.length || clientId) return;
    // id match
    const byId = clients.find(c => c.id === clientParam);
    if (byId) { setClientId(byId.id); setClientLocked(true); return; }
    // name-slug match
    const target = slugifyLabel(clientParam);
    const bySlug = clients.find(c => slugifyLabel(c.name) === target);
    if (bySlug) { setClientId(bySlug.id); setClientLocked(true); }
  }, [clientParam, clients, clientId]);

  const isQuickRequest = form?.submit_action?.creates === "quick_request";
  const requestTypeField = useMemo(() => fields.find(f => slugifyLabel(f.label) === REQUEST_TYPE_SLUG), [fields]);
  const titleField        = useMemo(() => fields.find(f => slugifyLabel(f.label) === TITLE_SLUG), [fields]);
  const shipByField       = useMemo(() => fields.find(f => slugifyLabel(f.label) === SHIP_BY_SLUG), [fields]);
  const descriptionField  = useMemo(() => fields.find(f => slugifyLabel(f.label) === DESCRIPTION_SLUG), [fields]);
  const specialIds = useMemo(() => new Set(
    [requestTypeField, titleField, shipByField, descriptionField].filter(Boolean).map(f => f!.id)
  ), [requestTypeField, titleField, shipByField, descriptionField]);

  const requestType = requestTypeField ? (values[requestTypeField.id] as RequestType | undefined) : undefined;

  // Build slug→value map so isFieldVisible can evaluate conditionals against user input.
  const valuesBySlug = useMemo(() => {
    const out: Record<string, any> = {};
    for (const f of fields) out[slugifyLabel(f.label)] = values[f.id];
    return out;
  }, [fields, values]);

  const visibleDynamicFields = useMemo(
    () => fields.filter(f => !specialIds.has(f.id) && isFieldVisible(f, valuesBySlug)),
    [fields, specialIds, valuesBySlug],
  );

  const selectedClient = clients.find(c => c.id === clientId);
  const isInternal = !!selectedClient && (selectedClient.is_internal || internalIds.has(selectedClient.id));

  async function submit() {
    if (!form) return;

    // Basic validation
    if (isQuickRequest && !clientId) { toast.error("Client is required"); return; }
    if (requestTypeField?.required && !requestType) { toast.error("Request type is required"); return; }
    if (titleField?.required && !values[titleField.id]) { toast.error("Title is required"); return; }
    const missing = visibleDynamicFields.filter(f => {
      if (!f.required) return false;
      const v = values[f.id];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing.length) { toast.error(`Missing required: ${missing.map(m => m.label).join(", ")}`); return; }

    setBusy(true);
    try {
      const titleValue = titleField ? String(values[titleField.id] ?? "").trim() : "";
      const descriptionValue = descriptionField ? String(values[descriptionField.id] ?? "").trim() : "";
      const shipBy = shipByField ? (values[shipByField.id] || null) : null;

      // Build custom_fields payload for the project + task
      const customFields: Record<string, any> = {};
      if (requestType) customFields.request_type = requestType;
      for (const f of visibleDynamicFields) {
        const v = values[f.id];
        if (v === undefined || v === null || v === "") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        customFields[slugifyLabel(f.label)] = { label: f.label, type: f.type, value: v };
      }

      let createdProjectId: string | null = null;
      let createdTaskId: string | null = null;

      if (isQuickRequest) {
        // Quick Request pipeline: project + unclaimed task, matching CreateWorkDialog exactly.
        const projectTitle = titleValue || REQUEST_TYPE_LABELS[requestType as RequestType] || form.name;
        const proj = await createProject({
          title: projectTitle,
          type: "quick_request",
          work_type: "request",
          status: "active",
          client_id: clientId,
          description: descriptionValue || null,
          start_date: todayISO(),
          go_live_date: shipBy || null,
          created_by: requestedBy ?? null,
          requested_by: requestedBy ?? null,
          custom_fields: customFields,
        } as any);
        createdProjectId = proj.id;

        // Auto-create one unclaimed task carrying the description
        const { data: task } = await supabase.from("pm_tasks").insert({
          project_id: proj.id,
          title: projectTitle,
          type: "design",
          status: "unclaimed",
          priority: "medium",
          duration_days: 1,
          due_date: shipBy || null,
          assignee_id: null,
          description: descriptionValue || null,
        } as any).select().single();
        createdTaskId = (task as any)?.id ?? null;

        if (typeof requestType === "string" && requestType.startsWith("careersite_")) {
          refreshCareerSiteProjects().catch(() => {});
        }
      } else {
        // Legacy path: attach to any project if action=task, else create project.
        const action = form.submit_action?.creates ?? "task";
        if (action === "project") {
          const { data } = await supabase.from("pm_projects").insert({
            title: titleValue || form.name,
            type: "quick_request",
            status: "active",
            description: descriptionValue || JSON.stringify(values, null, 2),
            requested_by: requestedBy,
            client_id: clientId || null,
          } as any).select().single();
          createdProjectId = (data as any)?.id ?? null;
        } else {
          const { data: anyProj } = await supabase.from("pm_projects").select("id").limit(1).maybeSingle();
          if (anyProj) {
            createdProjectId = (anyProj as any).id;
            const { data } = await supabase.from("pm_tasks").insert({
              project_id: (anyProj as any).id,
              title: titleValue || form.name,
              type: "design",
              status: "unclaimed",
              priority: "medium",
              duration_days: 1,
              description: descriptionValue || JSON.stringify(values, null, 2),
              assignee_id: null,
            } as any).select().single();
            createdTaskId = (data as any)?.id ?? null;
          }
        }
      }

      // Attach staged files/links at project level so all tasks see them.
      if ((files.length || links.length) && createdProjectId) {
        await persistIntakeAttachments({
          projectId: createdProjectId,
          taskId: null,
          files, links,
          userId: requestedBy,
        });
      }

      await supabase.from("pm_form_submissions").insert({
        form_id: form.id,
        payload: { request_type: requestType ?? null, title: titleValue, description: descriptionValue, ship_by: shipBy, client_id: clientId || null, ...values },
        submitter_name: name || null,
        submitter_email: email || null,
        created_project_id: createdProjectId,
        created_task_id: createdTaskId,
      } as any);

      const watcherIds = createdProjectId
        ? await applyClientWatchers(createdProjectId, clientId || null, requestType ?? null).catch(() => [])
        : [];

      setSubmitted({
        projectId: createdProjectId,
        watcherIds,
        alias: aliasFor(requestType ?? null),
        requestTypeLabel: requestTypeLabel(requestType ?? null),
      });
      toast.success("Submitted!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (!form) return <div ref={rootRef} className="p-3 md:p-6 max-w-xl mx-auto">Form not found.</div>;

  if (submitted) return (
    <div ref={rootRef} className={embed ? "p-4" : "p-6 max-w-xl mx-auto"}>
      <SubmissionSuccess
        projectId={submitted.projectId}
        watcherIds={submitted.watcherIds}
        confirmationAlias={submitted.alias}
        requestTypeLabel={submitted.requestTypeLabel}
      />
    </div>
  );

  return (
    <div ref={rootRef} className={embed ? "bg-transparent" : "min-h-screen bg-muted/20 py-10"}>
      <div className={embed ? "px-2" : "max-w-2xl mx-auto px-4"}>
        <Card><CardContent className="p-6 space-y-4">
          {!embed && (
            <div>
              <h1 className="text-xl font-bold font-unbounded">{form.name}</h1>
              {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
            </div>
          )}
          {embed && <h2 className="text-lg font-semibold">{form.name}</h2>}

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Your name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>

          {/* Client */}
          {isQuickRequest && (
            <div>
              <Label>Client *</Label>
              {clientLocked && selectedClient ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <Badge variant="outline" className={cn(isInternal && "ring-1 ring-[hsl(var(--internal)/0.5)]")}>
                    {selectedClient.name}
                  </Badge>
                  {isInternal && <span className="internal-pill">Internal</span>}
                  <span className="text-xs text-muted-foreground">Requesting on behalf of this client</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setClientLocked(false)}>
                    Change
                  </Button>
                </div>
              ) : (
                <ClientSearchCombobox
                  value={clientId}
                  onChange={setClientId}
                  clients={clients}
                  onClientsChanged={(next) => setClients(next)}
                />
              )}
              {isInternal && !clientLocked && (
                <p className="text-xs text-[hsl(var(--internal))] mt-1 flex items-center gap-1">
                  <Sparkle className="h-3 w-3" /> Internal HireClix request — will be color-coded for the team.
                </p>
              )}
            </div>
          )}

          {isQuickRequest && (
            <RequesterPicker
              value={requestedBy}
              onChange={setRequestedBy}
              label="Requested by"
              helpText="Pick the person tracking this request. They'll get updates as the work moves."
            />
          )}

          {/* Request type (grouped select if present) */}
          {requestTypeField && (
            <div>
              <Label>
                {requestTypeField.label}
                {requestTypeField.required && <span className="text-destructive"> *</span>}
              </Label>
              <GroupedRequestTypeSelect
                value={(values[requestTypeField.id] as RequestType) || ""}
                onChange={(v) => setValues({ ...values, [requestTypeField.id]: v })}
              />
              <p className="text-xs text-muted-foreground mt-1">Fields below change based on the request type.</p>
            </div>
          )}

          {/* Title */}
          {titleField && (
            <FormFieldRenderer
              field={titleField}
              value={values[titleField.id]}
              onChange={(v) => setValues({ ...values, [titleField.id]: v })}
            />
          )}

          {/* Dynamic per-type fields */}
          {visibleDynamicFields.length > 0 && (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              {requestType && (
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {REQUEST_TYPE_LABELS[requestType]} details
                </div>
              )}
              {visibleDynamicFields.map(f => (
                <FormFieldRenderer
                  key={f.id}
                  field={f}
                  value={values[f.id]}
                  onChange={(v) => setValues({ ...values, [f.id]: v })}
                />
              ))}
            </div>
          )}

          {/* Ship-by */}
          {shipByField && (
            <FormFieldRenderer
              field={shipByField}
              value={values[shipByField.id]}
              onChange={(v) => setValues({ ...values, [shipByField.id]: v })}
            />
          )}

          {/* Description */}
          {descriptionField && (
            <FormFieldRenderer
              field={descriptionField}
              value={values[descriptionField.id]}
              onChange={(v) => setValues({ ...values, [descriptionField.id]: v })}
            />
          )}

          <IntakeAttachmentsField
            files={files} onFilesChange={setFiles}
            links={links} onLinksChange={setLinks}
          />
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : isQuickRequest ? "Submit request" : "Submit"}
          </Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

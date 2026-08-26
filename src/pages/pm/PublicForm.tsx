import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FormFieldRenderer, isFieldVisible, type FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";
import { slugifyLabel } from "@/components/pm/forms/useInternalRequestForm";

import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { SubmissionSuccess } from "@/components/pm/intake/SubmissionSuccess";
import { ClientSearchCombobox, type ClientOption } from "@/components/pm/intake/ClientSearchCombobox";
import { GroupedRequestTypeSelect } from "@/components/pm/intake/GroupedRequestTypeSelect";
import { aliasFor } from "@/lib/pm/requestAliases";
import { REQUEST_TYPE_LABELS, requestTypeLabel, type RequestType } from "@/lib/pm/requestTypes";
import { refreshCareerSiteProjects, useInternalClientIds } from "@/lib/pm/clients";
import { fileToBase64, publicFormBootstrap, publicFormSubmit } from "@/lib/pm/publicFormClient";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

const REQUEST_TYPE_SLUG = "request_type";
const TITLE_SLUG = "title";
const SHIP_BY_SLUG = "ship_by_date";
const DESCRIPTION_SLUG = "description";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  const [form, setForm] = useState<any>(null);
  const [formReady, setFormReady] = useState(false);
  const [fields, setFields] = useState<FormFieldRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rosterUsers, setRosterUsers] = useState<{ id: string; name: string; role: string }[]>([]);
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
    emailSent: boolean;
  }>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
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

  // Load form + fields + clients via service-role function (no anon table grants).
  useEffect(() => {
    (async () => {
      if (!slug) return;
      try {
        const data = await publicFormBootstrap(slug);
        setForm(data.form);
        setFields((data.fields || []) as FormFieldRow[]);
        setClients((data.clients || []) as ClientOption[]);
        setRosterUsers((data.users || []) as { id: string; name: string; role: string }[]);
      } catch {
        setForm(null);
      } finally {
        setFormReady(true);
      }
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

  const isQuickRequest = true;
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
    if (!form || !slug) return;

    // Basic validation
    if (!clientId) { toast.error("Client is required"); return; }
    if (requestTypeField?.required && !requestType) { toast.error("Request type is required"); return; }
    if (titleField?.required && !values[titleField.id]) { toast.error("Title is required"); return; }
    const missing = visibleDynamicFields.filter(f => {
      if (!f.required) return false;
      const v = values[f.id];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing.length) { toast.error(`Missing required: ${missing.map(m => m.label).join(", ")}`); return; }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address or leave the field blank");
      return;
    }

    setBusy(true);
    setPreparing(files.length > 0);
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

      const filePayload = await Promise.all(files.map(async f => ({
        name: f.name,
        type: f.type,
        dataBase64: await fileToBase64(f),
      })));

      setPreparing(false);

      const result = await publicFormSubmit({
        slug,
        clientId,
        requestedBy,
        submitterName: name.trim(),
        submitterEmail: trimmedEmail,
        title: titleValue,
        description: descriptionValue,
        shipBy,
        requestType: requestType ?? null,
        requestTypeLabel: requestTypeLabel(requestType ?? null),
        customFields,
        payload: { request_type: requestType ?? null, title: titleValue, description: descriptionValue, ship_by: shipBy, client_id: clientId, ...values },
        files: filePayload,
        links,
      });

      if (typeof requestType === "string" && requestType.startsWith("careersite_")) {
        refreshCareerSiteProjects().catch(() => {});
      }

      if (email && !result.emailSent && !result.emailPending) {
        toast.warning("Request saved, but the confirmation email could not be sent.");
      }
      if (result.failedFiles?.length) {
        toast.warning(`Request saved, but some files could not be uploaded: ${result.failedFiles.join(", ")}`);
      }

      setSubmitted({
        projectId: result.projectId,
        watcherIds: result.watcherIds,
        alias: result.alias || aliasFor(requestType ?? null),
        requestTypeLabel: result.requestTypeLabel ?? requestTypeLabel(requestType ?? null),
        emailSent: result.emailSent,
      });
      toast.success("Submitted!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setBusy(false);
      setPreparing(false);
    }
  }

  if (!formReady) return <div ref={rootRef} className="p-3 md:p-6 max-w-xl mx-auto text-sm text-muted-foreground">Loading…</div>;
  if (!form) return <div ref={rootRef} className="p-3 md:p-6 max-w-xl mx-auto">Form not found.</div>;

  if (submitted) return (
    <div ref={rootRef} className={embed ? "p-4" : "p-4 md:p-6 max-w-xl mx-auto"}>
      <SubmissionSuccess
        projectId={submitted.projectId}
        watcherIds={submitted.watcherIds}
        confirmationAlias={submitted.alias}
        requestTypeLabel={submitted.requestTypeLabel}
        emailSent={submitted.emailSent}
      />
    </div>
  );

  return (
    <div ref={rootRef} className={embed ? "bg-transparent" : "min-h-screen bg-muted/20 py-6 md:py-10"}>
      <div className={embed ? "px-2" : "max-w-2xl mx-auto px-3 sm:px-4"}>
        <Card><CardContent className="p-4 md:p-6 space-y-4">
          {!embed && (
            <div>
              <h1 className="text-xl font-bold font-unbounded">{form.name}</h1>
              {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
            </div>
          )}
          {embed && <h2 className="text-lg font-semibold">{form.name}</h2>}

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Your name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>

          {/* Client */}
          {isQuickRequest && (
            <div>
              <Label>Client *</Label>
              {clientLocked && selectedClient ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <Badge variant="outline" className={cn(isInternal && "ring-1 ring-[hsl(var(--internal)/0.5)]")}>
                    {selectedClient.name}
                  </Badge>
                  {isInternal && <span className="internal-pill">Internal</span>}
                  <span className="text-xs text-muted-foreground hidden sm:inline truncate min-w-0">Requesting on behalf of this client</span>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs shrink-0" onClick={() => setClientLocked(false)}>
                    Change
                  </Button>
                </div>
              ) : (
                <ClientSearchCombobox
                  value={clientId}
                  onChange={setClientId}
                  clients={clients}
                  onClientsChanged={(next) => setClients(next)}
                  allowCreate={false}
                />
              )}
              {isInternal && !clientLocked && (
                <p className="text-xs text-[hsl(var(--internal))] mt-1 flex items-center gap-1">
                  <Sparkle className="h-3 w-3" /> Internal HireClix request — will be color-coded for the team.
                </p>
              )}
            </div>
          )}

          {isQuickRequest && rosterUsers.length > 0 && (
            <RequesterPicker
              value={requestedBy}
              onChange={setRequestedBy}
              users={rosterUsers}
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
            {preparing ? "Preparing…" : busy ? "Submitting…" : isQuickRequest ? "Submit request" : "Submit"}
          </Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

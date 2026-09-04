import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormFieldRenderer, isFieldVisible, type FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";
import { useInternalRequestForm, slugifyLabel } from "@/components/pm/forms/useInternalRequestForm";
import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { persistIntakeAttachments } from "@/lib/pm/api";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { REQUEST_TYPE_GROUPS, REQUEST_TYPE_LABELS, type RequestType } from "@/lib/pm/requestTypes";
import { createCareerSiteSupportRequest } from "@/lib/pm/supportQueue";
import type { PmProject } from "@/types/pm";
import { toast } from "sonner";

const CAREER_SITE_TYPES =
  REQUEST_TYPE_GROUPS.find((g) => g.key === "career_site")?.types ??
  (["careersite_support"] as RequestType[]);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live career site this request nests under. */
  project: Pick<PmProject, "id" | "title" | "client_id">;
  onCreated?: (requestProjectId: string) => void;
}

export function LogSupportRequestDialog({ open, onOpenChange, project, onCreated }: Props) {
  const { user } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("careersite_support");
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [requestedBy, setRequestedBy] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<StagedLink[]>([]);
  const [busy, setBusy] = useState(false);

  const { fields } = useInternalRequestForm(requestType);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setRequestType("careersite_support");
    setFieldValues({});
    setRequestedBy(user?.id ?? null);
    setFiles([]);
    setLinks([]);
  }, [open, user?.id]);

  useEffect(() => {
    setFieldValues({});
  }, [requestType]);

  const valuesBySlug = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of fields as FormFieldRow[]) out[slugifyLabel(f.label)] = fieldValues[f.id];
    return out;
  }, [fields, fieldValues]);

  const visibleFields = useMemo(
    () => (fields as FormFieldRow[]).filter((f) => isFieldVisible(f, valuesBySlug)),
    [fields, valuesBySlug],
  );

  const requestCustomFields = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of visibleFields) {
      const v = fieldValues[f.id];
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[slugifyLabel(f.label)] = { label: f.label, type: f.type, value: v };
    }
    return out;
  }, [visibleFields, fieldValues]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!project.client_id) {
      toast.error("This site needs a client before support requests can be logged");
      return;
    }
    const missing = visibleFields.filter((f) => {
      if (!f.required) return false;
      const v = fieldValues[f.id];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === "";
    });
    if (missing.length) {
      toast.error(`Missing required: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setBusy(true);
    try {
      const { project: created } = await createCareerSiteSupportRequest({
        title: title.trim(),
        clientId: project.client_id,
        parentProjectId: project.id,
        requestType,
        description: description.trim() || null,
        customFields: requestCustomFields,
        requestedBy: requestedBy ?? user?.id ?? null,
        createdBy: user?.id ?? null,
        creationSource: "manual",
        creationContext: { request_type: requestType, via: "live_site" },
      });

      if (files.length || links.length) {
        await persistIntakeAttachments({
          projectId: created.id,
          taskId: null,
          files,
          links,
          userId: user?.id ?? null,
        });
      }

      toast.success("Support request logged");
      onOpenChange(false);
      onCreated?.(created.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't log support request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New support request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground">
            Nested under <span className="font-medium text-foreground">{project.title}</span>. Same
            shape as Career Site Support requests from the intake form.
          </p>

          <div className="space-y-1.5">
            <Label>Request type</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {CAREER_SITE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REQUEST_TYPE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="support-req-title">Title</Label>
            <Input
              id="support-req-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs fixing or updating?"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSave();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="support-req-desc">Description</Label>
            <Textarea
              id="support-req-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context, URLs, repro steps…"
              rows={3}
            />
          </div>

          <RequesterPicker
            value={requestedBy}
            onChange={setRequestedBy}
            label="Requested by"
            helpText="Who submitted this on the client's behalf."
          />

          {visibleFields.length > 0 && (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {REQUEST_TYPE_LABELS[requestType]} details
              </div>
              {visibleFields.map((f) => (
                <FormFieldRenderer
                  key={f.id}
                  field={f}
                  value={fieldValues[f.id]}
                  onChange={(v) => setFieldValues((prev) => ({ ...prev, [f.id]: v }))}
                />
              ))}
            </div>
          )}

          <IntakeAttachmentsField
            files={files}
            onFilesChange={setFiles}
            links={links}
            onLinksChange={setLinks}
            label="Attachments & links"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!title.trim() || busy}>
            {busy ? "Creating…" : "Log request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

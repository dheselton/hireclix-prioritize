import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FormFieldRenderer } from "@/components/pm/forms/FormFieldRenderer";
import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { RequesterPicker } from "@/components/pm/intake/RequesterPicker";
import { persistIntakeAttachments } from "@/lib/pm/api";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [requestedBy, setRequestedBy] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<StagedLink[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("pm_forms").select("*").eq("shareable_slug", slug).maybeSingle();
      if (!f) return;
      setForm(f);
      const { data: ff } = await supabase.from("pm_form_fields").select("*").eq("form_id", f.id).order("sort_order");
      setFields(ff || []);
    })();
  }, [slug]);

  const isInternal = form?.kind === "internal";

  async function submit() {
    if (!form) return;
    setBusy(true);
    try {
      const title = (Object.values(values).find(v => typeof v === "string" && v.length) as string) || form.name;
      const action = form.submit_action?.creates ?? "task";
      let createdProjectId: string | null = null;
      let createdTaskId: string | null = null;

      if (action === "project") {
        const { data } = await supabase.from("pm_projects").insert({
          title, type: "quick_request", status: "active",
          description: JSON.stringify(values, null, 2),
          requested_by: requestedBy,
        } as any).select().single();
        createdProjectId = (data as any)?.id;
      } else {
        const { data: anyProj } = await supabase.from("pm_projects").select("id").limit(1).maybeSingle();
        if (anyProj) {
          createdProjectId = (anyProj as any).id;
          const { data } = await supabase.from("pm_tasks").insert({
            project_id: (anyProj as any).id, title, type: "design",
            status: requestedBy ? "claimed" : "unclaimed",
            priority: "medium", duration_days: 1,
            description: JSON.stringify(values, null, 2),
            assignee_id: requestedBy,
          } as any).select().single();
          createdTaskId = (data as any)?.id;
        }
      }

      // Always attach intake files/links at project level so every related task sees them.
      if ((files.length || links.length) && createdProjectId) {
        await persistIntakeAttachments({
          projectId: createdProjectId,
          taskId: null,
          files, links,
          userId: requestedBy,
        });
      }

      await supabase.from("pm_form_submissions").insert({
        form_id: form.id, payload: values, submitter_name: name, submitter_email: email,
        created_project_id: createdProjectId, created_task_id: createdTaskId,
      } as any);
      setSubmitted(true);
      toast.success("Submitted!");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (!form) return <div ref={rootRef} className="p-6 max-w-xl mx-auto">Form not found.</div>;
  if (submitted) return (
    <div ref={rootRef} className={embed ? "p-4" : "p-6 max-w-xl mx-auto"}>
      <Card><CardContent className="p-8 text-center space-y-2">
        <h1 className="text-xl font-bold">Thanks!</h1>
        <p className="text-sm text-muted-foreground">Your request was received and added to the queue.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div ref={rootRef} className={embed ? "bg-transparent" : "min-h-screen bg-muted/20 py-10"}>
      <div className={embed ? "px-2" : "max-w-2xl mx-auto px-4"}>
        <Card><CardContent className="p-6 space-y-4">
          {!embed && <h1 className="text-xl font-bold font-unbounded">{form.name}</h1>}
          {embed && <h2 className="text-lg font-semibold">{form.name}</h2>}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Your name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>
          {isInternal && (
            <RequesterPicker
              value={requestedBy}
              onChange={setRequestedBy}
              label="Assign updates to"
              helpText="Pick the person who should track this request internally."
            />
          )}
          {fields.map(f => (
            <FormFieldRenderer
              key={f.id}
              field={f}
              value={values[f.id]}
              onChange={(v) => setValues({ ...values, [f.id]: v })}
            />
          ))}
          <IntakeAttachmentsField
            files={files} onFilesChange={setFiles}
            links={links} onLinksChange={setLinks}
          />
          <Button className="w-full" onClick={submit} disabled={busy}>Submit</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

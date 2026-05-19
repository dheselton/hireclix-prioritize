import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
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

  async function submit() {
    if (!form) return;
    // create task or project
    const title = (Object.values(values).find(v => typeof v === "string" && v.length) as string) || form.name;
    const action = form.submit_action?.creates ?? "task";
    let createdProjectId: string | null = null;
    let createdTaskId: string | null = null;
    if (action === "project") {
      const { data } = await supabase.from("pm_projects").insert({
        title, type: "quick_request", status: "active", description: JSON.stringify(values, null, 2),
      } as any).select().single();
      createdProjectId = data?.id;
    } else {
      // pick first project to attach to (or create a parent inbox project)
      const { data: anyProj } = await supabase.from("pm_projects").select("id").limit(1).maybeSingle();
      if (anyProj) {
        const { data } = await supabase.from("pm_tasks").insert({
          project_id: anyProj.id, title, type: "design", status: "unclaimed", priority: "medium",
          duration_days: 1, description: JSON.stringify(values, null, 2),
        } as any).select().single();
        createdTaskId = data?.id;
      }
    }
    await supabase.from("pm_form_submissions").insert({
      form_id: form.id, payload: values, submitter_name: name, submitter_email: email,
      created_project_id: createdProjectId, created_task_id: createdTaskId,
    } as any);
    setSubmitted(true);
    toast.success("Submitted!");
  }

  if (!form) return <div className="p-6 max-w-xl mx-auto">Form not found.</div>;
  if (submitted) return (
    <div className="p-6 max-w-xl mx-auto">
      <Card><CardContent className="p-8 text-center space-y-2">
        <h1 className="text-xl font-bold">Thanks!</h1>
        <p className="text-sm text-muted-foreground">Your request was received and added to the queue.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 py-10">
      <div className="max-w-2xl mx-auto px-4">
        <Card><CardContent className="p-6 space-y-4">
          <h1 className="text-xl font-bold font-unbounded">{form.name}</h1>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Your name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          </div>
          {fields.map(f => (
            <div key={f.id}>
              <Label>{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
              {f.type === "textarea" ? (
                <Textarea value={values[f.id] ?? ""} onChange={e => setValues({ ...values, [f.id]: e.target.value })} />
              ) : f.type === "dropdown" ? (
                <Select value={values[f.id] ?? ""} onValueChange={v => setValues({ ...values, [f.id]: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {(f.options || []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input type={f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={values[f.id] ?? ""} onChange={e => setValues({ ...values, [f.id]: e.target.value })} />
              )}
            </div>
          ))}
          <Button className="w-full" onClick={submit}>Submit</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

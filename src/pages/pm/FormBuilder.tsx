import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FIELD_TYPES = ["text","textarea","date","dropdown","checkbox_group","multi_select","file","email","phone","number"];

function slugifyLabel(s: string) {
  return (s ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export default function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const reload = async () => {
    const { data: f } = await supabase.from("pm_forms").select("*").eq("id", id).maybeSingle();
    const { data: ff } = await supabase.from("pm_form_fields").select("*").eq("form_id", id).order("sort_order");
    const { data: sub } = await supabase.from("pm_form_submissions").select("*").eq("form_id", id).order("created_at", { ascending: false }).limit(20);
    setForm(f); setFields(ff || []); setSubmissions(sub || []);
  };
  useEffect(() => { if (id) reload(); }, [id]);

  async function saveForm(patch: any) {
    setForm({ ...form, ...patch });
    await supabase.from("pm_forms").update(patch).eq("id", id);
  }
  async function addField(type: string) {
    await supabase.from("pm_form_fields").insert({
      form_id: id, label: `New ${type}`, type, required: false, sort_order: fields.length,
    } as any);
    reload();
  }
  async function patchField(fid: string, patch: any) {
    await supabase.from("pm_form_fields").update(patch).eq("id", fid);
    reload();
  }
  async function delField(fid: string) {
    await supabase.from("pm_form_fields").delete().eq("id", fid);
    reload();
  }

  if (!form) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <Link to="/pm/forms" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Forms</Link>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Palette */}
        <Card className="lg:col-span-3"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Add Field</div>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map(t => (
              <Button key={t} size="sm" variant="outline" onClick={() => addField(t)}>{t}</Button>
            ))}
          </div>
        </CardContent></Card>

        {/* Canvas */}
        <Card className="lg:col-span-6"><CardContent className="p-4 space-y-3">
          <div>
            <Label>Form name</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onBlur={e => saveForm({ name: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={e => setForm({ ...form, description: e.target.value })}
              onBlur={e => saveForm({ description: e.target.value })}
              placeholder="Short subtitle explaining when this form should be used"
              rows={2}
            />
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Fields</div>
            {fields.map(f => {
              const isRequestType = slugifyLabel(f.label) === "request_type";
              const isLocked = isRequestType && form.shareable_slug === "quick-request";
              const rules: Array<{ field: string; in: string[] }> = Array.isArray(f.conditionals) ? f.conditionals : [];
              const firstRule = rules[0];
              return (
                <div key={f.id} className="border border-border rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                    <Input value={f.label} onChange={e => setFields(fields.map(x => x.id === f.id ? { ...x, label: e.target.value } : x))}
                      onBlur={e => patchField(f.id, { label: e.target.value })} className="flex-1" disabled={isLocked} />
                    <div className="flex items-center gap-1">
                      <Switch checked={f.required} onCheckedChange={v => patchField(f.id, { required: v })} disabled={isLocked} />
                      <span className="text-xs">required</span>
                    </div>
                    {isLocked ? (
                      <Badge variant="secondary" className="text-[10px]">Locked</Badge>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => delField(f.id)}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                  {(f.type === "dropdown" || f.type === "multi_select" || f.type === "checkbox_group") && (
                    <Input placeholder="Comma-separated options"
                      value={(f.options || []).join(",")}
                      onChange={e => setFields(fields.map(x => x.id === f.id ? { ...x, options: e.target.value.split(",").map((s: string) => s.trim()) } : x))}
                      onBlur={e => patchField(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      disabled={isLocked} />
                  )}
                  {!isLocked && (
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center text-xs">
                      <span className="text-muted-foreground">Show only when</span>
                      <Input
                        placeholder="field slug (e.g. request_type)"
                        value={firstRule?.field ?? ""}
                        onChange={e => {
                          const nextRule = { field: e.target.value, in: firstRule?.in ?? [] };
                          setFields(fields.map(x => x.id === f.id ? { ...x, conditionals: e.target.value ? [nextRule] : [] } : x));
                        }}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          const next = val ? [{ field: val, in: firstRule?.in ?? [] }] : [];
                          patchField(f.id, { conditionals: next });
                        }}
                        className="h-8"
                      />
                      <Input
                        placeholder="matches values (comma-separated)"
                        value={(firstRule?.in ?? []).join(",")}
                        onChange={e => {
                          const nextIn = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                          const nextRule = { field: firstRule?.field ?? "", in: nextIn };
                          setFields(fields.map(x => x.id === f.id ? { ...x, conditionals: nextRule.field ? [nextRule] : [] } : x));
                        }}
                        onBlur={e => {
                          const nextIn = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                          const rule = { field: firstRule?.field ?? "", in: nextIn };
                          patchField(f.id, { conditionals: rule.field && nextIn.length ? [rule] : [] });
                        }}
                        className="h-8"
                        disabled={!firstRule?.field}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {!fields.length && <div className="text-sm text-muted-foreground italic">No fields yet — add one from the palette.</div>}
          </div>
        </CardContent></Card>

        {/* Settings */}
        <Card className="lg:col-span-3"><CardContent className="p-4 space-y-3">
          <div className="text-xs uppercase text-muted-foreground">Settings</div>
          <div>
            <Label>On submit creates</Label>
            <Select value={form.submit_action?.creates ?? "task"} onValueChange={v => saveForm({ submit_action: { ...form.submit_action, creates: v } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Public URL</Label>
            <Input readOnly value={`${window.location.origin}/f/${form.shareable_slug}`} onClick={(e: any) => { e.currentTarget.select(); navigator.clipboard.writeText(e.currentTarget.value); toast.success("Copied"); }} />
          </div>
          <div>
            <Label>Webhook URL (optional)</Label>
            <Input value={form.webhook_url ?? ""} onChange={e => setForm({ ...form, webhook_url: e.target.value })} onBlur={e => saveForm({ webhook_url: e.target.value })} />
          </div>
          <div className="border-t border-border pt-3">
            <div className="text-xs uppercase text-muted-foreground mb-1">Submissions ({submissions.length})</div>
            <div className="space-y-1 max-h-48 overflow-auto text-xs">
              {submissions.map(s => (
                <div key={s.id} className="border border-border rounded p-2">
                  <div className="font-medium">{s.submitter_name || "Anonymous"}</div>
                  <div className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                </div>
              ))}
              {!submissions.length && <div className="italic text-muted-foreground">None yet</div>}
            </div>
          </div>
        </CardContent></Card>
      </div>

      <EmbedPanel form={form} />
    </div>
  );
}

function EmbedPanel({ form }: { form: any }) {
  const slug = form?.shareable_slug;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!slug) {
    return (
      <Card><CardContent className="p-4 text-sm text-muted-foreground">
        This form has no public slug yet — save the form to generate one.
      </CardContent></Card>
    );
  }
  const publicUrl = `${origin}/f/${slug}`;
  const iframeSnippet = `<iframe
  src="${publicUrl}?embed=1"
  width="100%"
  height="720"
  style="border:0;max-width:640px;background:transparent;"
  loading="lazy"
  title="${(form.name || "Request form").replace(/"/g, "&quot;")}"
></iframe>`;
  const jsSnippet = `<div data-pmform="${slug}"></div>
<script async src="${origin}/embed/pm-form.js"></script>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Share &amp; Embed</div>
          <div className="text-xs text-muted-foreground">Use the public link, drop in an iframe, or use the auto-resizing JS snippet on any website.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-border rounded p-3 space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Direct link</div>
          <Input readOnly value={publicUrl} onClick={(e: any) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(publicUrl, "Link")}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Open</a>
            </Button>
          </div>
        </div>

        <div className="border border-border rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Iframe embed</div>
            <Button size="sm" variant="outline" onClick={() => copy(iframeSnippet, "Iframe snippet")}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
          <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto whitespace-pre-wrap break-all max-h-40">{iframeSnippet}</pre>
          <p className="text-[11px] text-muted-foreground">Fixed-height iframe. Works anywhere HTML is allowed.</p>
        </div>

        <div className="border border-border rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">JS snippet (auto-resize)</div>
            <Button size="sm" variant="outline" onClick={() => copy(jsSnippet, "JS snippet")}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
          <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-auto whitespace-pre-wrap break-all max-h-40">{jsSnippet}</pre>
          <p className="text-[11px] text-muted-foreground">Loader script auto-sizes the iframe as the form grows.</p>
        </div>
      </div>
    </CardContent></Card>
  );
}

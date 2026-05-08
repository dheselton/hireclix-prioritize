import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FIELD_TYPES = ["text","textarea","date","dropdown","multi_select","file","email","phone","number"];

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
    <div className="p-6 max-w-7xl mx-auto space-y-4">
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
          <div className="border-t border-border pt-3 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Fields</div>
            {fields.map(f => (
              <div key={f.id} className="border border-border rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                  <Input value={f.label} onChange={e => setFields(fields.map(x => x.id === f.id ? { ...x, label: e.target.value } : x))}
                    onBlur={e => patchField(f.id, { label: e.target.value })} className="flex-1" />
                  <div className="flex items-center gap-1">
                    <Switch checked={f.required} onCheckedChange={v => patchField(f.id, { required: v })} />
                    <span className="text-xs">required</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => delField(f.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                {(f.type === "dropdown" || f.type === "multi_select") && (
                  <Input placeholder="Comma-separated options"
                    value={(f.options || []).join(",")}
                    onChange={e => setFields(fields.map(x => x.id === f.id ? { ...x, options: e.target.value.split(",").map((s: string) => s.trim()) } : x))}
                    onBlur={e => patchField(f.id, { options: e.target.value.split(",").map((s) => s.trim()) })} />
                )}
              </div>
            ))}
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
    </div>
  );
}

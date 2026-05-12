import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowLeft, Rocket, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TASK_TYPES } from "@/types/pm";
import { TimelineSetupWizard } from "@/components/pm/TimelineSetupWizard";

export default function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tpl, setTpl] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  

  const reload = async () => {
    const { data: t } = await supabase.from("pm_project_templates").select("*").eq("id", id).maybeSingle();
    const { data: tt } = await supabase.from("pm_template_tasks").select("*").eq("template_id", id).order("sort_order");
    setTpl(t); setTasks(tt || []);
  };
  useEffect(() => { if (id) reload(); }, [id]);

  async function patchTpl(p: any) { setTpl({ ...tpl, ...p }); await supabase.from("pm_project_templates").update(p).eq("id", id); }
  async function addTask() {
    await supabase.from("pm_template_tasks").insert({
      template_id: id, temp_id: `t${Date.now()}`, title: "New task", type: "design", duration_days: 3, sort_order: tasks.length,
    } as any);
    reload();
  }
  async function patchTask(tid: string, p: any) { await supabase.from("pm_template_tasks").update(p).eq("id", tid); reload(); }
  async function delTask(tid: string) { await supabase.from("pm_template_tasks").delete().eq("id", tid); reload(); }


  if (!tpl) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Link to="/pm/templates" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Templates</Link>
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Label>Name</Label>
            <Input value={tpl.name} onChange={e => setTpl({ ...tpl, name: e.target.value })} onBlur={e => patchTpl({ name: e.target.value })} />
          </div>
          <div>
            <Label>Go-live offset (days)</Label>
            <Input type="number" className="w-32" value={tpl.default_go_live_offset_days ?? 30}
              onChange={e => setTpl({ ...tpl, default_go_live_offset_days: Number(e.target.value) })}
              onBlur={e => patchTpl({ default_go_live_offset_days: Number(e.target.value) })} />
          </div>
          <Button onClick={() => setWizardOpen(true)}><Rocket className="h-4 w-4 mr-1" /> Create Project</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase text-muted-foreground">Tasks</div>
          <Button size="sm" variant="outline" onClick={addTask}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </div>
        {tasks.map(t => (
          <div key={t.id} className="grid grid-cols-12 gap-2 items-center border border-border rounded p-2">
            <Input className="col-span-5" value={t.title} onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} onBlur={e => patchTask(t.id, { title: e.target.value })} />
            <Select value={t.type} onValueChange={v => patchTask(t.id, { type: v })}>
              <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">{TASK_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="col-span-2" placeholder="Phase name" value={t.phase_name ?? ""} onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, phase_name: e.target.value } : x))} onBlur={e => patchTask(t.id, { phase_name: e.target.value })} />
            <div className="col-span-2 flex items-center gap-1">
              <Input type="number" value={t.duration_days} className="w-16"
                onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, duration_days: Number(e.target.value) } : x))}
                onBlur={e => patchTask(t.id, { duration_days: Number(e.target.value) })} />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
            <Button size="icon" variant="ghost" className="col-span-1" onClick={() => delTask(t.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
        {!tasks.length && <div className="text-sm text-muted-foreground italic">No tasks yet.</div>}
      </CardContent></Card>
    </div>
  );
}

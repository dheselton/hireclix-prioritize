import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowLeft, Rocket, Lock, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TASK_TYPES } from "@/types/pm";
import { TimelineSetupWizard } from "@/components/pm/TimelineSetupWizard";
import {
  TemplateTaskSnippetCell,
  isSnippetEligibleType,
} from "@/components/pm/snippets/TemplateTaskSnippetCell";
import { TemplateSnippetSummary } from "@/components/pm/snippets/TemplateSnippetSummary";
import { TeamsMultiSelect } from "@/components/pm/TeamsMultiSelect";
import { teamsFromTask, type Team } from "@/lib/pm/teams";

export default function TemplateBuilder() {
  const { id } = useParams<{ id: string }>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tpl, setTpl] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [snippetRefresh, setSnippetRefresh] = useState(0);
  const bumpSnippets = () => setSnippetRefresh(n => n + 1);

  const reload = async () => {
    const [{ data: t }, { data: tt }, { data: gg }, { data: pp }] = await Promise.all([
      supabase.from("pm_project_templates").select("*").eq("id", id).maybeSingle(),
      supabase.from("pm_template_tasks").select("*").eq("template_id", id).order("sort_order"),
      supabase.from("pm_template_page_groups").select("*").eq("template_id", id).order("sort_order"),
      supabase.from("pm_template_page_presets").select("*").eq("template_id", id).order("sort_order"),
    ]);
    setTpl(t); setTasks(tt || []); setGroups(gg || []); setPresets(pp || []);
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

  async function addGroup() {
    await supabase.from("pm_template_page_groups").insert({
      template_id: id, name: "Content Page", sort_order: groups.length,
    } as any);
    reload();
  }
  async function patchGroup(gid: string, p: any) { await supabase.from("pm_template_page_groups").update(p).eq("id", gid); reload(); }
  async function delGroup(gid: string) {
    await supabase.from("pm_template_page_groups").delete().eq("id", gid);
    reload();
  }
  async function addPreset(groupId: string, name: string) {
    if (!name.trim()) return;
    const count = presets.filter(p => p.page_group_id === groupId).length;
    await supabase.from("pm_template_page_presets").insert({
      template_id: id, page_group_id: groupId, name: name.trim(), sort_order: count,
    } as any);
    reload();
  }
  async function patchPreset(pid: string, p: any) { await supabase.from("pm_template_page_presets").update(p).eq("id", pid); reload(); }
  async function delPreset(pid: string) { await supabase.from("pm_template_page_presets").delete().eq("id", pid); reload(); }

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

      {/* Page Groups */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <div className="text-xs uppercase text-muted-foreground">Page Groups</div>
          </div>
          <Button size="sm" variant="outline" onClick={addGroup}><Plus className="h-3 w-3 mr-1" /> Add group</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Define a bundle of tasks (e.g. Wireframe → Design → Build → QA) that gets stamped out once per page when starting a project.
          Below in the Tasks list, assign tasks to a group to mark them as page slots.
        </p>
        {!groups.length && <div className="text-sm text-muted-foreground italic">No page groups yet.</div>}
        {groups.map(g => (
          <PageGroupCard key={g.id} group={g} presets={presets.filter(p => p.page_group_id === g.id)}
            slotTasks={tasks.filter(t => t.page_group_id === g.id)}
            onPatch={(p) => patchGroup(g.id, p)} onDelete={() => delGroup(g.id)}
            onAddPreset={(n) => addPreset(g.id, n)}
            onPatchPreset={patchPreset} onDelPreset={delPreset} />
        ))}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase text-muted-foreground">Tasks</div>
          <Button size="sm" variant="outline" onClick={addTask}><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </div>
        <div className="grid grid-cols-12 gap-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <div className="col-span-3">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Phase</div>
          <div className="col-span-2">Page Group</div>
          <div className="col-span-1">Days</div>
          <div className="col-span-1 text-center">Lock</div>
          <div className="col-span-1">Snippets</div>
        </div>
        {tasks.map(t => (
          <div key={t.id} className="border border-border rounded p-2 space-y-1">
            <div className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-3" value={t.title} onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} onBlur={e => patchTask(t.id, { title: e.target.value })} />
              <Select value={t.type} onValueChange={v => patchTask(t.id, { type: v })}>
                <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">{TASK_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="col-span-2" placeholder="Phase name" value={t.phase_name ?? ""} onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, phase_name: e.target.value } : x))} onBlur={e => patchTask(t.id, { phase_name: e.target.value })} />
              <Select value={t.page_group_id ?? "__none__"} onValueChange={v => patchTask(t.id, { page_group_id: v === "__none__" ? null : v })}>
                <SelectTrigger className="col-span-2"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="__none__">— (one-off)</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" className="col-span-1" value={t.duration_days}
                onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, duration_days: Number(e.target.value) } : x))}
                onBlur={e => patchTask(t.id, { duration_days: Number(e.target.value) })} />
              <div className="col-span-1 flex justify-center items-center gap-1">
                <Checkbox checked={!!t.locked} onCheckedChange={(v) => patchTask(t.id, { locked: !!v })} />
                {t.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className="col-span-1 flex items-center gap-1">
                {isSnippetEligibleType(t.type) ? (
                  <TemplateTaskSnippetCell templateTaskId={t.id} onChange={bumpSnippets} />
                ) : (
                  <span className="text-[11px] text-muted-foreground/60">—</span>
                )}
                <Button size="icon" variant="ghost" onClick={() => delTask(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Teams</span>
              <TeamsMultiSelect
                value={teamsFromTask(t)}
                onChange={(next: Team[]) => patchTask(t.id, { teams: next })}
                align="start"
                compact
              />
            </div>
          </div>
        ))}
        {!tasks.length && <div className="text-sm text-muted-foreground italic">No tasks yet.</div>}
      </CardContent></Card>

      <TemplateSnippetSummary
        templateTaskIds={tasks.map(t => t.id)}
        refreshKey={snippetRefresh}
      />
      <TimelineSetupWizard templateId={id || null} open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function PageGroupCard({ group, presets, slotTasks, onPatch, onDelete, onAddPreset, onPatchPreset, onDelPreset }: {
  group: any; presets: any[]; slotTasks: any[];
  onPatch: (p: any) => void; onDelete: () => void;
  onAddPreset: (name: string) => void;
  onPatchPreset: (id: string, p: any) => void; onDelPreset: (id: string) => void;
}) {
  const [newPreset, setNewPreset] = useState("");
  const expected = group.expected_page_count ?? 5;
  const cap = group.parallel_cap ?? 3;
  const override: Record<string, number> = group.reserved_by_phase || {};

  // Compute default reserved per phase
  const sumByPhase: Record<string, number> = {};
  for (const s of slotTasks) {
    const ph = s.phase_name || "Other";
    sumByPhase[ph] = (sumByPhase[ph] || 0) + (s.duration_days || 0);
  }
  const phases = Object.keys(sumByPhase);

  return (
    <div className="border border-border rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input className="flex-1" value={group.name} onBlur={e => onPatch({ name: e.target.value })}
          onChange={e => onPatch({ name: e.target.value })} />
        <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">{slotTasks.length} task slot(s)</span>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">Expected pages</Label>
          <Input type="number" min={1} value={expected}
            onChange={e => onPatch({ expected_page_count: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">Parallel cap</Label>
          <Input type="number" min={1} value={cap}
            onChange={e => onPatch({ parallel_cap: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">Discovery gate (temp_id)</Label>
          <Input placeholder="e.g. t_sitemap_approval" value={group.discovery_task_temp_id ?? ""}
            onChange={e => onPatch({ discovery_task_temp_id: e.target.value || null })} />
        </div>
      </div>

      {phases.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[11px] uppercase text-muted-foreground">Reserved time per phase (days)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {phases.map(ph => {
              const def = Math.max(1, Math.ceil((sumByPhase[ph] * expected) / cap));
              const cur = override[ph];
              return (
                <div key={ph} className="flex items-center gap-1.5">
                  <div className="text-xs flex-1 truncate" title={ph}>{ph}</div>
                  <Input type="number" min={0} className="h-7 w-16 text-xs"
                    placeholder={String(def)}
                    value={cur ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      const next = { ...override };
                      if (v === "") delete next[ph]; else next[ph] = Math.max(0, Number(v) || 0);
                      onPatch({ reserved_by_phase: next });
                    }} />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">def {def}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Blank uses the default formula: phase task days × expected pages ÷ parallel cap.</p>
        </div>
      )}

      <div className="space-y-1 pt-2">
        <div className="text-[11px] uppercase text-muted-foreground">Page presets (optional quick-picks)</div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs bg-muted border border-border">
              {p.name}
              <button onClick={() => onDelPreset(p.id)} className="text-muted-foreground hover:text-foreground"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input placeholder="e.g. Benefits, Life At, Locations…" value={newPreset}
            onChange={e => setNewPreset(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAddPreset(newPreset); setNewPreset(""); } }}
            className="h-8 text-sm" />
          <Button size="sm" variant="outline" onClick={() => { onAddPreset(newPreset); setNewPreset(""); }}>
            <Plus className="h-3 w-3 mr-1" /> Add preset
          </Button>
        </div>
      </div>
    </div>
  );
}

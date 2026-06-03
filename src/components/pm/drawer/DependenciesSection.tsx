import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import { STATUS_COLORS } from "@/types/pm";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { TaskPicker } from "./TaskPicker";

interface Dep { id: string; task_id: string; depends_on_task_id: string; reveal_mode?: string; }
interface TaskLite { id: string; title: string; status: string; project_id: string; project_title?: string; }

export function DependenciesSection({ taskId }: { taskId: string }) {
  const [blockedBy, setBlockedBy] = useState<{ dep: Dep; task: TaskLite }[]>([]);
  const [blocking, setBlocking] = useState<{ dep: Dep; task: TaskLite }[]>([]);
  const [pickerMode, setPickerMode] = useState<null | "blocked_by" | "blocking">(null);
  const { open } = useTaskDrawerLink();

  async function load() {
    const [{ data: bb }, { data: bk }] = await Promise.all([
      supabase.from("pm_task_dependencies").select("*").eq("task_id", taskId),
      supabase.from("pm_task_dependencies").select("*").eq("depends_on_task_id", taskId),
    ]);
    const ids = Array.from(new Set([...(bb || []).map((d: any) => d.depends_on_task_id), ...(bk || []).map((d: any) => d.task_id)]));
    let tmap = new Map<string, TaskLite>();
    if (ids.length) {
      const { data: ts } = await supabase.from("pm_tasks").select("id,title,status,project_id").in("id", ids);
      const pids = Array.from(new Set((ts || []).map((t: any) => t.project_id)));
      const { data: ps } = pids.length ? await supabase.from("pm_projects").select("id,title").in("id", pids) : { data: [] as any };
      const pmap = new Map((ps || []).map((p: any) => [p.id, p.title]));
      (ts || []).forEach((t: any) => tmap.set(t.id, { ...t, project_title: pmap.get(t.project_id) }));
    }
    setBlockedBy((bb || []).map((d: any) => ({ dep: d, task: tmap.get(d.depends_on_task_id)! })).filter(x => x.task));
    setBlocking((bk || []).map((d: any) => ({ dep: d, task: tmap.get(d.task_id)! })).filter(x => x.task));
  }
  useEffect(() => { load(); }, [taskId]);

  async function addDep(otherId: string, mode: "blocked_by" | "blocking") {
    const row = mode === "blocked_by"
      ? { task_id: taskId, depends_on_task_id: otherId, type: "finish_start", lag_days: 0, reveal_mode: "on_complete" }
      : { task_id: otherId, depends_on_task_id: taskId, type: "finish_start", lag_days: 0, reveal_mode: "on_complete" };
    await supabase.from("pm_task_dependencies").insert(row as any);
    await load();
  }
  async function removeDep(id: string) {
    await supabase.from("pm_task_dependencies").delete().eq("id", id);
    await load();
  }
  async function setReveal(depId: string, reveal_mode: string) {
    await supabase.from("pm_task_dependencies").update({ reveal_mode }).eq("id", depId);
    await load();
  }

  const Row = ({ task, depId }: { task: TaskLite; depId: string }) => (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40">
      <button className="flex-1 text-left min-w-0" onClick={() => open(task.id)}>
        <div className="text-sm truncate">{task.title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{task.project_title}</div>
      </button>
      <Badge className={(STATUS_COLORS as any)[task.status] ?? ""}>{task.status.replace("_", " ")}</Badge>
      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeDep(depId)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <SectionShell
      title="Dependencies"
      badge={<Badge variant="secondary" className="ml-1">{blockedBy.length + blocking.length}</Badge>}
    >
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Blocked by</div>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setPickerMode("blocked_by")}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          {blockedBy.map(({ dep, task }) => <Row key={dep.id} task={task} depId={dep.id} />)}
          {!blockedBy.length && <div className="text-xs text-muted-foreground italic px-2">None.</div>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Blocking</div>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setPickerMode("blocking")}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          {blocking.map(({ dep, task }) => <Row key={dep.id} task={task} depId={dep.id} />)}
          {!blocking.length && <div className="text-xs text-muted-foreground italic px-2">None.</div>}
        </div>
      </div>

      <TaskPicker
        open={!!pickerMode}
        onClose={() => setPickerMode(null)}
        excludeIds={[taskId, ...blockedBy.map(b => b.task.id), ...blocking.map(b => b.task.id)]}
        onPick={(id) => pickerMode && addDep(id, pickerMode)}
      />
    </SectionShell>
  );
}

export function useBlockedByCount(taskId: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("pm_task_dependencies").select("depends_on_task_id").eq("task_id", taskId);
      const ids = (data || []).map((d: any) => d.depends_on_task_id);
      if (!ids.length) { setN(0); return; }
      const { data: ts } = await supabase.from("pm_tasks").select("status").in("id", ids);
      const done = new Set(["approved", "complete"]);
      setN((ts || []).filter((t: any) => !done.has(t.status)).length);
    })();
  }, [taskId]);
  return n;
}

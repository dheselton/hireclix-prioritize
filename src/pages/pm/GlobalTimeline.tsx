import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import type { PmTask, PmProject } from "@/types/pm";
import { GanttChart } from "@/components/pm/GanttChart";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useViewMode } from "@/hooks/useViewMode";
import { TaskListView } from "@/components/pm/collections/TaskListView";
import { TaskGridView } from "@/components/pm/collections/TaskGridView";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { applyTaskChips, applyTaskMeMode } from "@/lib/pm/filters";

export default function GlobalTimeline() {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("globalTimeline", "list");
  const { isMe } = useMeMode();
  const { user } = useCurrentUser();
  const chips = useChipFilters("globalTimeline");

  const reload = async () => {
    const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
    setTasks(t); setProjects(p);
  };
  useEffect(() => { reload(); }, []);

  const visible = useMemo(() => {
    let v = filter === "all" ? tasks : tasks.filter(t => t.project_id === filter);
    v = applyTaskMeMode(v, isMe, user?.id);
    v = applyTaskChips(v, chips.active, user?.id);
    return v;
  }, [tasks, filter, isMe, user?.id, chips.active]);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <CollectionToolbar
        title="Global Timeline"
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        chipState={chips}
        extraControls={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-64 h-8"><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              <SelectItem value="all">All projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <Card><CardContent className="p-0">
        <GanttChart tasks={visible} deps={[]} onTaskClick={drawer.open} />
      </CardContent></Card>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Tasks <span className="text-foreground/50">({visible.length})</span>
        </h2>
        {mode === "list"
          ? <TaskListView tasks={visible} projects={projById} onOpen={drawer.open} onChanged={reload} />
          : <TaskGridView tasks={visible} projects={projById} onOpen={drawer.open} onChanged={reload} />}
      </div>

      <TaskDrawer />
    </div>
  );
}

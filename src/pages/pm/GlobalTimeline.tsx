import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/pm/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
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
import { applyTaskChips, applyTaskMeMode, applyTaskTypes } from "@/lib/pm/filters";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";

export default function GlobalTimeline() {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("globalTimeline", "list");
  const { isMe } = useMeMode();
  const { user } = useCurrentUser();
  const chips = useChipFilters("globalTimeline");
  const { types } = useTypeFilter("globalTimeline");
  const typesKey = useMemo(() => [...types].sort().join(","), [types]);

  const reload = async () => {
    const [t, p] = await Promise.all([fetchTasks(undefined, { types: [...types] }), fetchProjects()]);
    setTasks(t); setProjects(p);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [typesKey]);
  useTasksChanged(reload);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const workType = useWorkTypeFilter("globalTimeline");

  const visible = useMemo(() => {
    let v = filter === "all" ? tasks : tasks.filter(t => t.project_id === filter);
    v = applyTaskTypes(v, types);
    v = applyTaskMeMode(v, isMe, user?.id);
    v = applyTaskChips(v, chips.active, user?.id);
    if (workType.value !== "all") {
      v = v.filter(t => {
        const wt = (projById.get(t.project_id) as any)?.work_type ?? "project";
        return wt === workType.value;
      });
    }
    return v;
  }, [tasks, filter, isMe, user?.id, chips.active, types, workType.value, projById]);

  const isMobile = useIsMobile();

  // Mobile fallback data: projects represented in the visible task set.
  const taskCountByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of visible) m.set(t.project_id, (m.get(t.project_id) ?? 0) + 1);
    return m;
  }, [visible]);

  const timelineProjects = useMemo(() => {
    const list = projects.filter(p => (filter === "all" ? taskCountByProject.has(p.id) : p.id === filter));
    return [...list].sort((a, b) => (a.go_live_date ?? "9999").localeCompare(b.go_live_date ?? "9999"));
  }, [projects, filter, taskCountByProject]);



  return (
    <div className="p-3 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <CollectionToolbar
        title="Global Timeline"
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        chipState={chips}
        typeFilterPage="globalTimeline"
        actions={<WorkTypeFilterToggle value={workType.value} onChange={workType.set} />}
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
      {/* Gantt is unusable on phones — fall back to a compact project list. */}
      {isMobile ? (
        <Card><CardContent className="p-2 space-y-1">
          <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Projects</div>
          {timelineProjects.length === 0 && (
            <div className="px-2 py-3 text-xs italic text-muted-foreground">No projects</div>
          )}
          {timelineProjects.map(p => (
            <Link
              key={p.id}
              to={`/pm/projects/${p.id}`}
              className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/60 transition"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  Go-live {fmtDate(p.go_live_date)} · {taskCountByProject.get(p.id) ?? 0} tasks
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                {String(p.status).replace(/_/g, " ")}
              </Badge>
            </Link>
          ))}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <GanttChart tasks={visible} deps={[]} onTaskClick={drawer.open} />
        </CardContent></Card>
      )}

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

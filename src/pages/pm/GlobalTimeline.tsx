import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/pm/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
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
import { applyTaskChips, applyTaskMeMode, applyTaskTypes, applyWorkScope } from "@/lib/pm/filters";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { useWorkScope } from "@/hooks/useWorkScope";
import { WorkScopeToggle } from "@/components/pm/WorkScopeToggle";
import { EMPTY_PROJECTS, EMPTY_TASKS, useProjectsQuery, useTasksQuery } from "@/lib/pm/queries";
import { WorkListSkeleton, WorkLoadError } from "@/components/pm/WorkLoadingState";
import {
  UNSET_MILESTONE_KEY,
  UNSET_MILESTONE_LABEL,
  compareProjectsByMilestone,
  milestoneLabel,
  useMilestoneDefinitions,
} from "@/lib/pm/milestones";
import { MilestoneBadge } from "@/components/pm/MilestoneSelect";
import type { PmProject, PmTask } from "@/types/pm";

type GroupMode = "go_live" | "milestone";

export default function GlobalTimeline() {
  const tasksQuery = useTasksQuery();
  const projectsQuery = useProjectsQuery();
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const [filter, setFilter] = useState<string>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("go_live");
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("globalTimeline", "list");
  const { isMe } = useMeMode();
  const { user } = useCurrentUser();
  const chips = useChipFilters("globalTimeline");
  const { types } = useTypeFilter("globalTimeline");
  const { data: defs = [] } = useMilestoneDefinitions({ includeInactive: true });
  const reload = () => { void tasksQuery.refetch(); void projectsQuery.refetch(); };

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const workType = useWorkTypeFilter("globalTimeline");
  const scope = useWorkScope();

  const visible = useMemo(() => {
    let v = filter === "all" ? tasks : tasks.filter(t => t.project_id === filter);
    v = applyWorkScope(v, scope.value, projById);
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
  }, [tasks, filter, scope.value, isMe, user?.id, chips.active, types, workType.value, projById]);

  const isMobile = useIsMobile();

  const taskCountByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of visible) m.set(t.project_id, (m.get(t.project_id) ?? 0) + 1);
    return m;
  }, [visible]);

  const timelineProjects = useMemo(() => {
    const list = projects.filter(p => (filter === "all" ? taskCountByProject.has(p.id) : p.id === filter));
    const sorted = [...list];
    if (groupMode === "milestone") {
      sorted.sort((a, b) => compareProjectsByMilestone(a, b, defs)
        || (a.go_live_date ?? "9999").localeCompare(b.go_live_date ?? "9999"));
    } else {
      sorted.sort((a, b) => (a.go_live_date ?? "9999").localeCompare(b.go_live_date ?? "9999"));
    }
    return sorted;
  }, [projects, filter, taskCountByProject, groupMode, defs]);

  const projectGroups = useMemo(() => {
    if (groupMode !== "milestone") return null;
    const order = [...defs.map((d) => d.key), UNSET_MILESTONE_KEY];
    const map = new Map<string, PmProject[]>();
    for (const p of timelineProjects) {
      const key = p.milestone ?? UNSET_MILESTONE_KEY;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return order
      .filter((k) => map.has(k))
      .map((k) => ({
        key: k,
        label: k === UNSET_MILESTONE_KEY ? UNSET_MILESTONE_LABEL : milestoneLabel(k, defs),
        projects: map.get(k)!,
      }));
  }, [groupMode, timelineProjects, defs]);

  const taskGroups = useMemo(() => {
    if (groupMode !== "milestone") return null;
    const order = [...defs.map((d) => d.key), UNSET_MILESTONE_KEY];
    const map = new Map<string, PmTask[]>();
    for (const t of visible) {
      const key = projById.get(t.project_id)?.milestone ?? UNSET_MILESTONE_KEY;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return order
      .filter((k) => map.has(k))
      .map((k) => ({
        key: k,
        label: k === UNSET_MILESTONE_KEY ? UNSET_MILESTONE_LABEL : milestoneLabel(k, defs),
        tasks: map.get(k)!,
      }));
  }, [groupMode, visible, projById, defs]);

  function renderProjectRow(p: PmProject) {
    return (
      <Link
        key={p.id}
        to={`/pm/projects/${p.id}`}
        className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/60 transition"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{p.title}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Go-live {fmtDate(p.go_live_date)} · {taskCountByProject.get(p.id) ?? 0} tasks</span>
            {p.milestone && <MilestoneBadge milestone={p.milestone} className="text-[10px]" />}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
          {String(p.status).replace(/_/g, " ")}
        </Badge>
      </Link>
    );
  }

  return (
    <div className="page-shell max-w-[1400px] mx-auto space-y-4">
      <CollectionToolbar
        title="Global Timeline"
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        chipState={chips}
        typeFilterPage="globalTimeline"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <Button
                size="sm"
                variant={groupMode === "go_live" ? "default" : "ghost"}
                className="h-8 rounded-none"
                onClick={() => setGroupMode("go_live")}
              >
                By go-live
              </Button>
              <Button
                size="sm"
                variant={groupMode === "milestone" ? "default" : "ghost"}
                className="h-8 rounded-none"
                onClick={() => setGroupMode("milestone")}
              >
                By Milestone
              </Button>
            </div>
            <WorkScopeToggle value={scope.value} onChange={scope.set} />
            <WorkTypeFilterToggle value={workType.value} onChange={workType.set} />
          </div>
        }
        extraControls={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-64 h-8"><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              <SelectItem value="all">All projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      {(tasksQuery.isPending || projectsQuery.isPending) ? (
        <WorkListSkeleton />
      ) : (tasksQuery.isError || projectsQuery.isError) ? (
        <WorkLoadError retry={reload} />
      ) : (
      <>
      {isMobile || groupMode === "milestone" ? (
        <Card><CardContent className="p-2 space-y-1">
          <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Projects {groupMode === "milestone" ? "by Milestone" : ""}
          </div>
          {timelineProjects.length === 0 && (
            <div className="px-2 py-3 text-xs italic text-muted-foreground">No projects</div>
          )}
          {projectGroups
            ? projectGroups.map((g) => (
              <div key={g.key} className="space-y-1 pt-2">
                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label} ({g.projects.length})
                </div>
                {g.projects.map(renderProjectRow)}
              </div>
            ))
            : timelineProjects.map(renderProjectRow)}
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
        {taskGroups
          ? taskGroups.map((g) => (
            <div key={g.key} className="mb-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label} ({g.tasks.length})
              </h3>
              {mode === "list"
                ? <TaskListView tasks={g.tasks} projects={projById} onOpen={drawer.open} onChanged={reload} />
                : <TaskGridView tasks={g.tasks} projects={projById} onOpen={drawer.open} onChanged={reload} />}
            </div>
          ))
          : (mode === "list"
            ? <TaskListView tasks={visible} projects={projById} onOpen={drawer.open} onChanged={reload} />
            : <TaskGridView tasks={visible} projects={projById} onOpen={drawer.open} onChanged={reload} />)}
      </div>

      <TaskDrawer />
      </>
      )}
    </div>
  );
}

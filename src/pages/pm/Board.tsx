import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3 } from "lucide-react";
import { fetchTasks, fetchProjects, updateTask, logActivity } from "@/lib/pm/api";
import type { PmTask, PmProject, TaskStatus, PmRole } from "@/types/pm";
import { TASK_STATUSES } from "@/types/pm";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { fmtDateShort } from "@/lib/pm/format";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { useTasksChanged } from "@/lib/pm/refresh";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TaskListView } from "@/components/pm/collections/TaskListView";
import { TaskGridView } from "@/components/pm/collections/TaskGridView";
import { ProjectWorkGrid } from "@/components/pm/collections/ProjectWorkGrid";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { applyTaskChips, applyTaskMeMode, applyTaskTypes } from "@/lib/pm/filters";
import { useWatchedTaskIds } from "@/lib/pm/watchers";
import { useTaskAssigneesMap } from "@/lib/pm/assignees";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { useViewMode } from "@/hooks/useViewMode";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { WorkKanban } from "@/components/pm/work/WorkKanban";

const COL_LABELS: Record<TaskStatus, string> = {
  unclaimed: "Unclaimed", claimed: "Claimed", in_progress: "In Progress", blocked: "Blocked",
  in_review: "In Review", approved: "Approved", complete: "Complete",
};

const DEFAULT_COLUMNS_BY_ROLE: Record<string, TaskStatus[]> = {
  designer: ["unclaimed", "claimed", "in_progress", "in_review", "complete"],
  developer: ["in_progress", "blocked", "in_review", "complete"],
  pm: [...TASK_STATUSES],
  submitter: [...TASK_STATUSES],
};

function loadCols(role: PmRole | null | undefined): TaskStatus[] {
  const key = `pm.boardColumns.${role ?? "anon"}`;
  if (typeof window === "undefined") return DEFAULT_COLUMNS_BY_ROLE[role ?? "pm"];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_COLUMNS_BY_ROLE[role ?? "pm"];
    const arr = JSON.parse(raw) as TaskStatus[];
    return arr.length ? arr : DEFAULT_COLUMNS_BY_ROLE[role ?? "pm"];
  } catch { return DEFAULT_COLUMNS_BY_ROLE[role ?? "pm"]; }
}

export default function Board() {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const { user } = useCurrentUser();
  const drawer = useTaskDrawerLink();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { isMe } = useMeMode();
  const chips = useChipFilters("board");
  const role = user?.role ?? null;
  const [cols, setCols] = useState<TaskStatus[]>(() => loadCols(role));

  // Re-seed if user (and thus role) changes.
  useEffect(() => { setCols(loadCols(role)); }, [role]);

  const persistCols = (next: TaskStatus[]) => {
    setCols(next);
    try { localStorage.setItem(`pm.boardColumns.${role ?? "anon"}`, JSON.stringify(next)); } catch {}
  };

  const [boardMode, setBoardMode] = useViewMode("board", "projects");
  const changeMode = (m: typeof boardMode) => setBoardMode(m);

  const { types } = useTypeFilter("board");
  const typesKey = useMemo(() => [...types].sort().join(","), [types]);

  const reload = async () => {
    setTasks(await fetchTasks(undefined, { types: [...types] }));
    setProjects(await fetchProjects());
  };
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [typesKey]);
  useTasksChanged(reload);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // types now sourced above

  const workType = useWorkTypeFilter("board");

  const coMap = useTaskAssigneesMap();
  const myCoTaskIds = useMemo(() => {
    if (!user?.id) return new Set<string>();
    const s = new Set<string>();
    coMap.forEach((users, tid) => { if (users.includes(user.id)) s.add(tid); });
    return s;
  }, [coMap, user?.id]);

  const visible = useMemo(() => {
    let v = applyTaskTypes(tasks, types);
    v = applyTaskMeMode(v, isMe, user?.id, myCoTaskIds);
    v = applyTaskChips(v, chips.active, user?.id, undefined, myCoTaskIds);
    if (workType.value !== "all") {
      v = v.filter(t => {
        const wt = (projById.get(t.project_id) as any)?.work_type ?? "project";
        return wt === workType.value;
      });
    }
    return v;
  }, [tasks, isMe, user?.id, chips.active, types, workType.value, projById, myCoTaskIds]);

  const hiddenStatuses = TASK_STATUSES.filter(s => !cols.includes(s));
  const hiddenCounts = hiddenStatuses.map(s => ({ s, n: visible.filter(t => t.status === s).length }));

  async function moveTo(taskId: string, status: TaskStatus) {
    const t = tasks.find(x => x.id === taskId);
    if (!t || t.status === status) return;
    await updateTask(taskId, { status });
    await logActivity({ task_id: taskId, project_id: t.project_id, user_id: user?.id, action: "task.status_changed", payload: { from: t.status, to: status } });
    toast.success(`Moved to ${COL_LABELS[status]}`);
    reload();
  }

  return (
    <div className="p-6 space-y-4">
      <UnclaimedBanner />
      <CollectionToolbar
        title="Board"
        subtitle={
          boardMode === "kanban" ? "Drag cards across columns to update status." :
          boardMode === "projects" ? "Projects with active work — open a card to drill in." :
          "Tasks across all statuses."
        }
        mode={boardMode}
        onModeChange={(m) => changeMode(m as any)}
        modes={["projects", "kanban", "list", "grid"]}
        chipState={chips}
        typeFilterPage="board"
        actions={
          <div className="flex items-center gap-2">
            <WorkTypeFilterToggle value={workType.value} onChange={workType.set} />
            {boardMode === "kanban" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Columns3 className="h-4 w-4 mr-1" /> Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 z-50 bg-popover" align="end">
                  <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Show columns</div>
                  <div className="space-y-1.5">
                    {TASK_STATUSES.map(s => (
                      <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={cols.includes(s)}
                          onCheckedChange={(checked) => {
                            if (checked) persistCols(TASK_STATUSES.filter(x => cols.includes(x) || x === s));
                            else persistCols(cols.filter(x => x !== s));
                          }}
                        />
                        {COL_LABELS[s]}
                      </label>
                    ))}
                  </div>
                  <Button
                    size="sm" variant="ghost" className="w-full mt-2 h-7 text-xs"
                    onClick={() => persistCols(DEFAULT_COLUMNS_BY_ROLE[role ?? "pm"])}
                  >
                    Reset to default
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        }
      />

      {boardMode === "kanban" && hiddenCounts.some(h => h.n > 0) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>Hidden:</span>
          {hiddenCounts.filter(h => h.n > 0).map(h => (
            <button
              key={h.s}
              type="button"
              onClick={() => persistCols([...cols, h.s].filter((v, i, a) => a.indexOf(v) === i))}
              className="inline-flex items-center gap-1 px-2 h-5 rounded border border-border hover:bg-muted"
            >
              <span>{COL_LABELS[h.s]}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">{h.n}</Badge>
            </button>
          ))}
        </div>
      )}

      {boardMode === "projects" && (
        <ProjectWorkGrid tasks={visible} projects={projById} meId={user?.id ?? null} onOpenTask={drawer.open} onChanged={reload} />
      )}

      {boardMode === "list" && (
        <TaskListView tasks={visible} projects={projById} onOpen={drawer.open} onChanged={reload} />
      )}

      {boardMode === "grid" && (
        <TaskGridView tasks={visible} projects={projById} onOpen={drawer.open} onChanged={reload} />
      )}

      {boardMode === "kanban" && (
        <WorkKanban tasks={visible} columns={cols} projects={projById} onOpen={drawer.open} onMove={moveTo} />
      )}

      <TaskDrawer />
    </div>
  );
}

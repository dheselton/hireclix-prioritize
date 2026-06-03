import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3, Zap, FolderKanban } from "lucide-react";
import { fetchTasks, fetchProjects, updateTask, logActivity } from "@/lib/pm/api";
import type { PmTask, PmProject, TaskStatus, PmRole } from "@/types/pm";
import { TASK_STATUSES } from "@/types/pm";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { StatusPill } from "@/components/pm/StatusPill";
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
import { useTaskAssigneesMap } from "@/lib/pm/assignees";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { useViewMode } from "@/hooks/useViewMode";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { CreateWorkDialog } from "@/components/pm/CreateWorkDialog";

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

export default function Work() {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [openCreate, setOpenCreate] = useState<null | "select" | "request" | "project">(null);
  const { user } = useCurrentUser();
  const drawer = useTaskDrawerLink();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { isMe } = useMeMode();
  // Reuse the "board" viewKey so existing deep links and saved chip state stay intact.
  const chips = useChipFilters("board");
  const role = user?.role ?? null;
  const [cols, setCols] = useState<TaskStatus[]>(() => loadCols(role));

  useEffect(() => { setCols(loadCols(role)); }, [role]);

  const persistCols = (next: TaskStatus[]) => {
    setCols(next);
    try { localStorage.setItem(`pm.boardColumns.${role ?? "anon"}`, JSON.stringify(next)); } catch {}
  };

  // Default to the flat task list — the "see everything" view.
  const [mode, setMode] = useViewMode("work", "list");

  const { types } = useTypeFilter("board");
  const typesKey = useMemo(() => [...types].sort().join(","), [types]);

  const reload = async () => {
    setTasks(await fetchTasks(undefined, { types: [...types] }));
    setProjects(await fetchProjects());
  };
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [typesKey]);
  useTasksChanged(reload);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const workType = useWorkTypeFilter("board");

  const coMap = useTaskAssigneesMap();
  const myCoTaskIds = useMemo(() => {
    if (!user?.id) return new Set<string>();
    const s = new Set<string>();
    coMap.forEach((users, tid) => { if (users.includes(user.id)) s.add(tid); });
    return s;
  }, [coMap, user?.id]);

  const visibleTasks = useMemo(() => {
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
  const hiddenCounts = hiddenStatuses.map(s => ({ s, n: visibleTasks.filter(t => t.status === s).length }));

  async function moveTo(taskId: string, status: TaskStatus) {
    const t = tasks.find(x => x.id === taskId);
    if (!t || t.status === status) return;
    await updateTask(taskId, { status });
    await logActivity({ task_id: taskId, project_id: t.project_id, user_id: user?.id, action: "task.status_changed", payload: { from: t.status, to: status } });
    toast.success(`Moved to ${COL_LABELS[status]}`);
    reload();
  }

  const subtitle =
    mode === "list" ? "Every project across the team — quick requests and full projects." :
    mode === "kanban" ? "Drag cards across columns to update status." :
    mode === "projects" ? "All projects with active work. Quick requests show as compact cards." :
    "Tasks across all statuses.";

  return (
    <div className="p-6 space-y-4">
      <UnclaimedBanner />
      <CollectionToolbar
        title="Work"
        subtitle={subtitle}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        modes={["list", "projects", "kanban", "grid"]}
        chipState={chips}
        typeFilterPage="board"
        actions={
          <div className="flex items-center gap-2">
            <WorkTypeFilterToggle value={workType.value} onChange={workType.set} />
            {user?.role !== "submitter" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setOpenCreate("request")} title="Lightweight project (1–3 tasks)">
                  <Zap className="h-4 w-4 mr-1" /> Quick Request
                </Button>
                <Button size="sm" onClick={() => setOpenCreate("project")} title="Multi-phase project with timeline">
                  <FolderKanban className="h-4 w-4 mr-1" /> Project
                </Button>
              </>
            )}
            {mode === "kanban" && (
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

      {mode === "kanban" && hiddenCounts.some(h => h.n > 0) && (
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

      {mode === "list" && (
        <TaskListView tasks={visibleTasks} projects={projById} onOpen={drawer.open} onChanged={reload} />
      )}

      {mode === "projects" && (
        <ProjectWorkGrid tasks={visibleTasks} projects={projById} meId={user?.id ?? null} onOpenTask={drawer.open} onChanged={reload} />
      )}

      {mode === "grid" && (
        <TaskGridView tasks={visibleTasks} projects={projById} onOpen={drawer.open} onChanged={reload} />
      )}

      {mode === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {cols.map(s => {
            const items = visibleTasks.filter(t => t.status === s);
            return (
              <div key={s}
                className="flex-shrink-0 w-72 bg-muted/30 rounded-lg p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (draggingId) { moveTo(draggingId, s); setDraggingId(null); } }}
              >
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide">{COL_LABELS[s]}</div>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map(t => {
                    const proj = projById.get(t.project_id);
                    const blocked = t.status === "blocked";
                    return (
                      <Card
                        key={t.id}
                        draggable
                        onDragStart={() => setDraggingId(t.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => drawer.open(t.id)}
                        className={cn("cursor-pointer hover:shadow-md transition", blocked && "border-red-500/60")}
                      >
                        <CardContent className="p-2.5 space-y-1.5">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                            <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                          </div>
                          <div className="text-sm font-medium leading-tight">{t.title}</div>
                          <div className="text-[11px] text-muted-foreground">{proj?.title}</div>
                          {blocked && t.dev_blocker && <div className="text-[11px] text-red-600 italic">⚠ {t.dev_blocker}</div>}
                          <div className="flex items-center justify-between pt-1">
                            <span onClick={(e) => e.stopPropagation()}>
                              <MultiAssigneeChip taskId={t.id} primaryId={t.assignee_id} size="xs" onChanged={reload} />
                            </span>
                            <span className="text-[11px] text-muted-foreground">{fmtDateShort(t.due_date)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateWorkDialog
        open={openCreate !== null}
        onOpenChange={(v) => { if (!v) setOpenCreate(null); }}
        initialStep={openCreate ?? "select"}
        onCreated={reload}
      />
      <TaskDrawer />
    </div>
  );
}

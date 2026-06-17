import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plus, Trash2, FileText } from "lucide-react";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { useSubtaskCounts, type SubtaskCount } from "@/components/pm/SubtaskBadge";
import { fmtDate } from "@/lib/pm/format";
import { useMeMode } from "@/hooks/useMeMode";
import { useViewMode } from "@/hooks/useViewMode";
import { STATUS_GROUPS, groupForStatus, typeBadgeClass, priorityDotClass, type StatusGroupId } from "@/lib/pm/statusGroups";
import type { PmTask, PmDependency, TaskStatus } from "@/types/pm";
import { computeHiddenTaskIds } from "@/lib/pm/reveal";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { BoardColumn } from "./board/BoardColumn";
import { BoardTaskCard } from "./board/BoardTaskCard";
import { GROUP_PRIMARY_STATUS } from "./board/boardStyles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddPageDialog } from "./AddPageDialog";
import { removePageFromProject } from "@/lib/pm/pageGroups";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { Users } from "lucide-react";

type TypePill = "all" | "design" | "dev" | "qa";

const TYPE_FILTER: Record<Exclude<TypePill, "all">, string[]> = {
  design: ["design", "content"],
  dev: ["dev"],
  qa: ["qa"],
};

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function TasksTab({ tasks, deps = [], projectId, meId, templateId, onAddTask }: {
  tasks: PmTask[]; deps?: PmDependency[]; projectId: string; meId: string | null; templateId?: string | null;
  onAddTask?: () => void;
}) {
  const navigate = useNavigate();
  const [view, setView] = useViewMode(`project.tasks.${projectId}`, "list");
  const [pill, setPill] = useState<TypePill>("all");
  const { isMe, setMode: setMeMode } = useMeMode();
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<StatusGroupId, boolean>>({
    ready: false, claimed: false, in_progress: false, in_review: false, complete: true,
  });
  // Project boards don't surface the "Claimed" concept — that's only meaningful
  // for unclaimed quick-task requests. Group claimed tasks into Ready.
  const PROJECT_GROUPS = useMemo(() => STATUS_GROUPS.filter(g => g.id !== "claimed"), []);
  const groupIdFor = (s: TaskStatus): StatusGroupId => {
    const g = groupForStatus(s).id;
    return g === "claimed" ? "ready" : g;
  };
  const [showUpcoming, setShowUpcoming] = useState<boolean>(() => {
    // Default to TRUE so new projects (where every task is dependency-blocked)
    // aren't blank on first load. Only hide when the user has explicitly opted out.
    try { return localStorage.getItem(`pm.showUpcoming.${projectId}`) !== "0"; } catch { return true; }
  });
  function toggleUpcoming() {
    setShowUpcoming(v => {
      const nv = !v;
      try { localStorage.setItem(`pm.showUpcoming.${projectId}`, nv ? "1" : "0"); } catch {}
      return nv;
    });
  }

  const hiddenIds = useMemo(() => computeHiddenTaskIds(tasks, deps), [tasks, deps]);
  const upcomingCount = useMemo(
    () => tasks.filter(t => hiddenIds.has(t.id)).length,
    [tasks, hiddenIds],
  );

  const team = useTeamFilter(`project.${projectId}`);

  const filtered = useMemo(() => {
    // Safety net: if hiding upcoming would leave nothing visible, override and show all.
    const effectiveShowUpcoming = showUpcoming || (tasks.length > 0 && tasks.every(t => hiddenIds.has(t.id)));
    let out = tasks;
    if (!effectiveShowUpcoming) out = out.filter(t => !hiddenIds.has(t.id));
    if (pill !== "all") out = out.filter(t => TYPE_FILTER[pill].includes(t.type));
    if (isMe && meId) out = out.filter(t => t.assignee_id === meId);
    out = out.filter(t => team.filterTask(t));
    return out;
  }, [tasks, pill, isMe, meId, hiddenIds, showUpcoming, team]);

  const byGroup = useMemo(() => {
    const m: Record<StatusGroupId, PmTask[]> = { ready: [], claimed: [], in_progress: [], in_review: [], complete: [] };
    for (const t of filtered) m[groupIdFor(t.status)].push(t);
    return m;
  }, [filtered]);

  const counts = useSubtaskCounts(filtered.map(t => t.id));

  // Board-only local state for optimistic D&D + inline edits
  const [boardTasks, setBoardTasks] = useState<PmTask[]>(filtered);
  const snapshotRef = useRef<PmTask[] | null>(null);
  useEffect(() => {
    setBoardTasks(prev => {
      // Preserve local ordering when possible; sync identity + fields from incoming `filtered`.
      const byId = new Map(filtered.map(t => [t.id, t]));
      const kept = prev.filter(t => byId.has(t.id)).map(t => byId.get(t.id)!);
      const keptIds = new Set(kept.map(t => t.id));
      const added = filtered.filter(t => !keptIds.has(t.id));
      return [...kept, ...added];
    });
  }, [filtered]);

  const boardByGroup = useMemo(() => {
    const m: Record<StatusGroupId, PmTask[]> = { ready: [], claimed: [], in_progress: [], in_review: [], complete: [] };
    for (const t of boardTasks) m[groupIdFor(t.status)].push(t);
    return m;
  }, [boardTasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? boardTasks.find(t => t.id === activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(id: string): StatusGroupId | null {
    if (id.startsWith("col:")) return id.slice(4) as StatusGroupId;
    const t = boardTasks.find(x => x.id === id);
    return t ? groupIdFor(t.status) : null;
  }

  function handleDragStart(e: DragStartEvent) {
    snapshotRef.current = boardTasks;
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    setBoardTasks(prev => {
      const activeTask = prev.find(t => t.id === active.id);
      if (!activeTask) return prev;
      const targetGroup = STATUS_GROUPS.find(g => g.id === overContainer)!;
      const newStatus: TaskStatus = targetGroup.statuses.includes(activeTask.status)
        ? activeTask.status
        : GROUP_PRIMARY_STATUS[overContainer];
      const updated = prev.map(t => t.id === active.id ? { ...t, status: newStatus } : t);
      // Move to end of new container
      const without = updated.filter(t => t.id !== active.id);
      const moved = updated.find(t => t.id === active.id)!;
      const targetList = updated.filter(t => groupForStatus(t.status).id === overContainer && t.id !== active.id);
      const lastTargetId = targetList[targetList.length - 1]?.id;
      const insertIdx = lastTargetId
        ? without.findIndex(t => t.id === lastTargetId) + 1
        : without.length;
      const next = [...without];
      next.splice(insertIdx, 0, moved);
      return next;
    });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) { snapshotRef.current = null; return; }
    const activeId = String(active.id);
    const overId = String(over.id);

    const snapshot = snapshotRef.current ?? boardTasks;
    const originalTask = snapshot.find(t => t.id === activeId);
    if (!originalTask) { snapshotRef.current = null; return; }

    // Determine target column from over-id (column droppable OR another card).
    let overContainer: StatusGroupId | null = null;
    if (overId.startsWith("col:")) {
      overContainer = overId.slice(4) as StatusGroupId;
    } else {
      const overTask = snapshot.find(t => t.id === overId);
      if (overTask) overContainer = groupForStatus(overTask.status).id;
    }
    if (!overContainer) { snapshotRef.current = null; return; }

    const originalContainer = groupForStatus(originalTask.status).id;
    const targetGroup = STATUS_GROUPS.find(g => g.id === overContainer)!;
    const newStatus: TaskStatus = targetGroup.statuses.includes(originalTask.status)
      ? originalTask.status
      : GROUP_PRIMARY_STATUS[overContainer];
    const statusChanged = newStatus !== originalTask.status;

    // Build authoritative post-drop list from the pre-drag snapshot.
    const updatedTask: PmTask = { ...originalTask, status: newStatus };
    const others = snapshot.filter(t => t.id !== activeId);

    let nextTasks: PmTask[];
    if (overContainer === originalContainer && overId !== activeId && !overId.startsWith("col:")) {
      // Same-column reorder: arrayMove within the column ids.
      const colIds = snapshot.filter(t => groupForStatus(t.status).id === originalContainer).map(t => t.id);
      const oldIdx = colIds.indexOf(activeId);
      const newIdx = colIds.indexOf(overId);
      const reorderedIds = (oldIdx !== -1 && newIdx !== -1) ? arrayMove(colIds, oldIdx, newIdx) : colIds;
      const colMap = new Map(snapshot.map(t => [t.id, t]));
      let r = 0;
      nextTasks = snapshot.map(t =>
        groupForStatus(t.status).id === originalContainer ? colMap.get(reorderedIds[r++])! : t,
      );
    } else {
      // Cross-column move (or drop-on-column): insert at end of target column.
      const targetColIds = snapshot.filter(t => groupForStatus(t.status).id === overContainer && t.id !== activeId).map(t => t.id);
      const lastTargetId = targetColIds[targetColIds.length - 1];
      const next = [...others];
      const insertIdx = lastTargetId ? next.findIndex(t => t.id === lastTargetId) + 1 : next.length;
      next.splice(insertIdx, 0, updatedTask);
      nextTasks = next;
    }

    setBoardTasks(nextTasks);

    const affectedGroups = new Set<StatusGroupId>([overContainer]);
    if (statusChanged) affectedGroups.add(originalContainer);

    try {
      const updates: Promise<unknown>[] = [];
      for (const gid of affectedGroups) {
        const list = nextTasks.filter(t => groupForStatus(t.status).id === gid);
        list.forEach((t, idx) => {
          const patch: Record<string, unknown> = { sort_order: idx };
          if (t.id === activeId && statusChanged) patch.status = newStatus;
          updates.push(Promise.resolve(supabase.from("pm_tasks").update(patch).eq("id", t.id)));
        });
      }
      const results = await Promise.all(updates);
      const firstErr = (results as Array<{ error?: unknown }>).find(r => r && r.error);
      if (firstErr) throw firstErr.error;
      if (statusChanged) {
        const label = STATUS_GROUPS.find(g => g.id === overContainer)?.label ?? "";
        toast.success(`Moved to ${label}`);
      }
      emitTasksChanged();
    } catch {
      if (snapshotRef.current) setBoardTasks(snapshotRef.current);
      toast.error("Couldn't move task");
    } finally {
      snapshotRef.current = null;
    }
  }

  async function changeStatus(taskId: string, gid: StatusGroupId) {
    const task = boardTasks.find(t => t.id === taskId);
    if (!task) return;
    const targetGroup = STATUS_GROUPS.find(g => g.id === gid)!;
    if (targetGroup.statuses.includes(task.status)) return;
    const newStatus = GROUP_PRIMARY_STATUS[gid];
    const prev = boardTasks;
    setBoardTasks(boardTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    const { error } = await supabase.from("pm_tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      setBoardTasks(prev);
      toast.error("Couldn't update status");
    }
  }

  async function changeDate(taskId: string, iso: string | null) {
    const prev = boardTasks;
    setBoardTasks(boardTasks.map(t => t.id === taskId ? { ...t, due_date: iso } : t));
    const { error } = await supabase.from("pm_tasks").update({ due_date: iso }).eq("id", taskId);
    if (error) {
      setBoardTasks(prev);
      toast.error("Couldn't update date");
    }
  }

  const pills: { id: TypePill | "me"; label: string; teamColor?: string }[] = [
    { id: "all", label: "All" },
    { id: "design", label: "Design", teamColor: "hsl(280 70% 60%)" },
    { id: "dev", label: "Dev", teamColor: "hsl(150 60% 45%)" },
    { id: "qa", label: "QA", teamColor: "hsl(50 90% 50%)" },
    { id: "me", label: "My Tasks" },
  ];

  function chipCls(active: boolean) {
    return `h-7 px-3 rounded-full text-xs font-medium border transition inline-flex items-center gap-1.5 ${
      active ? "bg-info/10 text-info border-info" : "bg-background text-muted-foreground border-border hover:bg-muted"
    }`;
  }

  const openTask = (id: string) => navigate(`/pm/tasks/${id}`);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {pills.map(p => {
          const active = p.id === "me" ? isMe : pill === p.id;
          return (
            <button key={p.id} type="button" className={chipCls(active)}
              onClick={() => {
                if (p.id === "me") setMeMode(isMe ? "all" : "me");
                else setPill(p.id as TypePill);
              }}>
              {p.teamColor && (
                <span className="h-2 w-2 rounded-full" style={{ background: p.teamColor }} />
              )}
              {p.label}
            </button>
          );
        })}
        {onAddTask && (
          <Button size="sm" onClick={onAddTask} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> New task
          </Button>
        )}
        {templateId && (
          <Button size="sm" variant="outline" onClick={() => setAddPageOpen(true)} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Add page
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!team.bypass && (
            <button
              type="button"
              onClick={() => team.setShowAll(!team.showAll)}
              className={`h-7 px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition ${
                team.showAll
                  ? "bg-background text-muted-foreground border-border hover:bg-muted"
                  : "bg-info/10 text-info border-info"
              }`}
              title={team.showAll ? "Show only my team's tasks" : "Show every task on this project"}
            >
              <Users className="h-3 w-3" />
              {team.showAll ? "Showing all tasks" : team.label}
            </button>
          )}
          {upcomingCount > 0 && (
            <button
              type="button"
              onClick={toggleUpcoming}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              title={showUpcoming ? "Hide tasks awaiting prerequisites" : "Show tasks awaiting prerequisites"}
            >
              {showUpcoming ? `Hide upcoming (${upcomingCount})` : `+ ${upcomingCount} upcoming`}
            </button>
          )}
          <div className="flex gap-1">
            <button type="button" className={chipCls(view === "list")} onClick={() => setView("list")}>List</button>
            <button type="button" className={chipCls(view === "kanban")} onClick={() => setView("kanban")}>Board</button>
          </div>
        </div>
      </div>

      {/* Pages (grouped) */}
      {view === "list" && (() => {
        const pageMap = new Map<string, { label: string; tasks: PmTask[] }>();
        for (const t of filtered) {
          if (!t.page_group_key) continue;
          if (!pageMap.has(t.page_group_key)) pageMap.set(t.page_group_key, { label: t.page_label || "Page", tasks: [] });
          pageMap.get(t.page_group_key)!.tasks.push(t);
        }
        if (!pageMap.size) return null;
        return (
          <Card>
            <CardContent className="p-2 space-y-1">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Pages ({pageMap.size})
              </div>
              {Array.from(pageMap.entries()).map(([key, { label, tasks: pageTasks }]) => {
                const done = pageTasks.filter(t => t.status === "complete" || t.status === "approved").length;
                const isC = !!collapsedPages[key];
                return (
                  <div key={key} className="border border-border rounded">
                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30">
                      <button type="button" onClick={() => setCollapsedPages(c => ({ ...c, [key]: !c[key] }))}
                        className="flex items-center gap-2 flex-1">
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isC ? "" : "rotate-90"}`} />
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{done}/{pageTasks.length}</span>
                      </button>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={async () => {
                          if (!confirm(`Remove "${label}" and its ${pageTasks.length} task(s)?`)) return;
                          await removePageFromProject(projectId, key);
                          emitTasksChanged();
                          toast.success(`Removed ${label}`);
                        }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {!isC && (
                      <div className="px-2 pb-2 space-y-1">
                        {pageTasks.map(t => {
                          const g = groupForStatus(t.status);
                          return <TaskRow key={t.id} task={t} groupColorBg={g.bg} count={counts.get(t.id)} onClick={() => openTask(t.id)} />;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* List */}
      {view === "list" && (
        <div className="space-y-2">
          {STATUS_GROUPS.map(g => {
            const list = byGroup[g.id];
            const isCollapsed = collapsed[g.id];
            return (
              <Card key={g.id}>
                <CardContent className="p-2">
                  <button type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40"
                    onClick={() => setCollapsed(c => ({ ...c, [g.id]: !c[g.id] }))}>
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                    <span className={`text-[12px] font-semibold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                    <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{list.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 mt-1">
                      {list.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground italic">No tasks</div>
                      )}
                      {list.map(t => (
                        <TaskRow key={t.id} task={t} groupColorBg={g.bg} count={counts.get(t.id)} onClick={() => openTask(t.id)} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Board */}
      {view === "kanban" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            if (snapshotRef.current) setBoardTasks(snapshotRef.current);
            snapshotRef.current = null;
            setActiveId(null);
          }}
        >
          <div className="grid grid-cols-4 gap-3">
            {STATUS_GROUPS.map(g => (
              <BoardColumn key={g.id} group={g} tasks={boardByGroup[g.id]} isDragActive={activeId !== null}>
                {boardByGroup[g.id].map(t => (
                  <BoardTaskCard
                    key={t.id}
                    task={t}
                    count={counts.get(t.id)}
                    onClick={() => openTask(t.id)}
                    onStatusChange={(gid) => changeStatus(t.id, gid)}
                    onDateChange={(iso) => changeDate(t.id, iso)}
                    allTasks={boardTasks}
                    deps={deps}
                  />
                ))}
              </BoardColumn>
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <BoardTaskCard
                task={activeTask}
                count={counts.get(activeTask.id)}
                onClick={() => {}}
                onStatusChange={() => {}}
                onDateChange={() => {}}
                allTasks={boardTasks}
                deps={deps}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {templateId && (
        <AddPageDialog projectId={projectId} templateId={templateId} open={addPageOpen} onOpenChange={setAddPageOpen} />
      )}
    </div>
  );
}

function TaskRow({ task, groupColorBg, count, onClick }: {
  task: PmTask; groupColorBg: string; count?: SubtaskCount; onClick: () => void;
}) {
  const preview = stripHtml(task.description);
  const teams = (Array.isArray((task as any).teams) ? (task as any).teams : []) as string[];
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 pl-0 pr-3 py-1.5 rounded border border-transparent cursor-pointer transition hover:border-info"
    >
      <div className={`w-[3px] self-stretch rounded-full ${groupColorBg}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{task.title}</span>
          {count && count.total > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
              {count.done}/{count.total}
            </span>
          )}
        </div>
        {preview && (
          <p className="text-[11px] text-muted-foreground truncate">{preview}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {teams.map(t => (
          <TeamPillInline key={t} team={t} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground lowercase shrink-0">{task.type}</span>
      <span onClick={(e) => e.stopPropagation()}>
        <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" />
      </span>
      <span className="text-[11px] text-muted-foreground w-16 text-right">{fmtDate(task.due_date)}</span>
      <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} title={task.priority} />
    </div>
  );
}

function TeamPillInline({ team }: { team: string }) {
  // Inline (untyped) renderer to avoid extra imports — color map is small.
  const colors: Record<string, string> = {
    design: "hsl(280 70% 60%)", dev: "hsl(150 60% 45%)", pm: "hsl(220 70% 55%)",
    qa: "hsl(50 90% 50%)", strategy: "hsl(260 70% 60%)", analytics: "hsl(190 70% 45%)",
    csm: "hsl(330 65% 55%)", support: "hsl(15 80% 55%)",
  };
  const c = colors[team] ?? "hsl(var(--muted-foreground))";
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium" style={{ borderColor: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      <span className="capitalize">{team}</span>
    </span>
  );
}


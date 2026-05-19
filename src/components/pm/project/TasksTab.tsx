import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useSubtaskCounts, type SubtaskCount } from "@/components/pm/SubtaskBadge";
import { fmtDate } from "@/lib/pm/format";
import { useMeMode } from "@/hooks/useMeMode";
import { useViewMode } from "@/hooks/useViewMode";
import { STATUS_GROUPS, groupForStatus, typeBadgeClass, priorityDotClass, type StatusGroupId } from "@/lib/pm/statusGroups";
import type { PmTask, TaskStatus } from "@/types/pm";
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

export function TasksTab({ tasks, projectId, meId }: {
  tasks: PmTask[]; projectId: string; meId: string | null;
}) {
  const navigate = useNavigate();
  const [view, setView] = useViewMode(`project.tasks.${projectId}`, "list");
  const [pill, setPill] = useState<TypePill>("all");
  const { isMe, setMode: setMeMode } = useMeMode();
  const [collapsed, setCollapsed] = useState<Record<StatusGroupId, boolean>>({
    ready: false, in_progress: false, in_review: false, complete: true,
  });

  const filtered = useMemo(() => {
    let out = tasks;
    if (pill !== "all") out = out.filter(t => TYPE_FILTER[pill].includes(t.type));
    if (isMe && meId) out = out.filter(t => t.assignee_id === meId);
    return out;
  }, [tasks, pill, isMe, meId]);

  const byGroup = useMemo(() => {
    const m: Record<StatusGroupId, PmTask[]> = { ready: [], in_progress: [], in_review: [], complete: [] };
    for (const t of filtered) m[groupForStatus(t.status).id].push(t);
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
    const m: Record<StatusGroupId, PmTask[]> = { ready: [], in_progress: [], in_review: [], complete: [] };
    for (const t of boardTasks) m[groupForStatus(t.status).id].push(t);
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
    return t ? groupForStatus(t.status).id : null;
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

    let nextTasks = boardTasks;
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) { snapshotRef.current = null; return; }

    // Reorder within the same column
    if (!overId.startsWith("col:") && activeId !== overId) {
      const containerIds = boardTasks.filter(t => groupForStatus(t.status).id === overContainer).map(t => t.id);
      const oldIdx = containerIds.indexOf(activeId);
      const newIdx = containerIds.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reorderedIds = arrayMove(containerIds, oldIdx, newIdx);
        // Rebuild boardTasks preserving other columns' order
        const others = boardTasks.filter(t => groupForStatus(t.status).id !== overContainer);
        const reordered = reorderedIds.map(id => boardTasks.find(t => t.id === id)!);
        // splice back in original relative position by walking original order
        const next: PmTask[] = [];
        let rIdx = 0;
        for (const t of boardTasks) {
          if (groupForStatus(t.status).id === overContainer) {
            next.push(reordered[rIdx++]);
          } else {
            next.push(t);
          }
        }
        nextTasks = next;
        setBoardTasks(next);
      }
    }

    // Persist: update moved task's status (if changed) + re-number sort_order for affected column(s)
    const original = snapshotRef.current ?? [];
    const movedTask = nextTasks.find(t => t.id === activeId);
    const originalTask = original.find(t => t.id === activeId);
    const statusChanged = movedTask && originalTask && movedTask.status !== originalTask.status;

    const affectedGroups = new Set<StatusGroupId>([overContainer]);
    if (statusChanged && originalTask) affectedGroups.add(groupForStatus(originalTask.status).id);

    try {
      const updates: Promise<unknown>[] = [];
      for (const gid of affectedGroups) {
        const list = nextTasks.filter(t => groupForStatus(t.status).id === gid);
        list.forEach((t, idx) => {
          const patch: Record<string, unknown> = { sort_order: idx };
          if (t.id === activeId && statusChanged) patch.status = movedTask!.status;
          updates.push(supabase.from("pm_tasks").update(patch).eq("id", t.id));
        });
      }
      const results = await Promise.all(updates);
      const firstErr = (results as Array<{ error?: unknown }>).find(r => r && r.error);
      if (firstErr) throw firstErr.error;
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

  const pills: { id: TypePill | "me"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "design", label: "Design" },
    { id: "dev", label: "Dev" },
    { id: "qa", label: "QA" },
    { id: "me", label: "My Tasks" },
  ];

  function chipCls(active: boolean) {
    return `h-7 px-3 rounded-full text-xs font-medium border transition ${
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
              {p.label}
            </button>
          );
        })}
        <div className="ml-auto flex gap-1">
          <button type="button" className={chipCls(view === "list")} onClick={() => setView("list")}>List</button>
          <button type="button" className={chipCls(view === "kanban")} onClick={() => setView("kanban")}>Board</button>
        </div>
      </div>

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
        <div className="grid grid-cols-4 gap-3">
          {STATUS_GROUPS.map(g => (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`text-[12px] font-semibold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{byGroup[g.id].length}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {byGroup[g.id].map(t => (
                  <TaskCard key={t.id} task={t} count={counts.get(t.id)} onClick={() => openTask(t.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, groupColorBg, count, onClick }: {
  task: PmTask; groupColorBg: string; count?: SubtaskCount; onClick: () => void;
}) {
  const preview = stripHtml(task.description);
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
      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
        {task.type}
      </span>
      <UserAvatar userId={task.assignee_id} size="xs" />
      <span className="text-[11px] text-muted-foreground w-16 text-right">{fmtDate(task.due_date)}</span>
      <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} title={task.priority} />
    </div>
  );
}

function TaskCard({ task, count, onClick }: { task: PmTask; count?: SubtaskCount; onClick: () => void }) {
  const preview = stripHtml(task.description);
  return (
    <Card onClick={onClick} className="cursor-pointer transition hover:border-info">
      <CardContent className="p-3 space-y-2 min-h-[110px] flex flex-col">
        <div className="text-[12px] font-bold leading-snug line-clamp-2">{task.title}</div>
        {preview && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{preview}</p>
        )}
        <span className={`inline-block self-start text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
          {task.type}
        </span>
        <div className="flex items-center justify-between pt-1 mt-auto">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{fmtDate(task.due_date) || "—"}</span>
            {count && count.total > 0 && (
              <span>· {count.done}/{count.total} subtasks</span>
            )}
          </div>
          <UserAvatar userId={task.assignee_id} size="xs" />
        </div>
      </CardContent>
    </Card>
  );
}

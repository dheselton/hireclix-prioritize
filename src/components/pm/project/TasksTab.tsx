import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Plus, Trash2, FileText, ArrowUpDown, X } from "lucide-react";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { useSubtaskCounts, type SubtaskCount } from "@/components/pm/SubtaskBadge";
import { fmtDate } from "@/lib/pm/format";
import { useMeMode } from "@/hooks/useMeMode";
import { useViewMode } from "@/hooks/useViewMode";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { TaskTriagePopover } from "@/components/pm/TaskTriagePopover";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { toast } from "sonner";
import { AddPageDialog } from "./AddPageDialog";
import { removePageFromProject } from "@/lib/pm/pageGroups";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { useWatchedTaskIds } from "@/lib/pm/watchers";
import { Users, Eye } from "lucide-react";
import { KIND_META, TASK_KINDS, getTaskKind, isRaidOpen, type TaskKind } from "@/lib/pm/taskKind";
import { TEAM_COLORS, type Team } from "@/lib/pm/teams";
import { RaidStrip } from "./RaidStrip";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkTaskActions } from "@/components/pm/collections/BulkTaskActions";

type TypePill = "all" | "design" | "dev" | "qa";

/** Project-scoped status filters, deep-linkable via ?taskFilter= / ?chips=. */
export type ProjectTaskFilter = "overdue" | "blocked" | "open" | "in_review" | "done";

const TASK_FILTER_LABEL: Record<ProjectTaskFilter, string> = {
  overdue: "Overdue",
  blocked: "Blocked",
  open: "Open",
  in_review: "In review",
  done: "Done",
};

const VALID_TASK_FILTERS = new Set<string>(["overdue", "blocked", "open", "in_review", "done"]);

const isDoneStatus = (s: string) => s === "complete" || s === "approved";

function matchesTaskFilter(t: PmTask, f: ProjectTaskFilter): boolean {
  const today = new Date().toISOString().slice(0, 10);
  switch (f) {
    case "overdue": return !!t.due_date && t.due_date < today && !isDoneStatus(t.status);
    case "blocked": return t.status === "blocked";
    case "open": return !isDoneStatus(t.status);
    case "in_review": return t.status === "in_review";
    case "done": return isDoneStatus(t.status);
  }
}

/** Read (and strip) the project-scoped filter deep-link params. */
function readInitialTaskFilter(): ProjectTaskFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("taskFilter");
    const chips = params.get("chips");
    let value: ProjectTaskFilter | null = null;
    if (raw && VALID_TASK_FILTERS.has(raw)) value = raw as ProjectTaskFilter;
    else if (chips) {
      const first = chips.split(",").map(s => s.trim()).find(s => VALID_TASK_FILTERS.has(s));
      if (first) value = first as ProjectTaskFilter;
    }
    if (params.has("taskFilter") || params.has("chips")) {
      params.delete("taskFilter");
      params.delete("chips");
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
    }
    return value;
  } catch { return null; }
}

const TYPE_FILTER: Record<Exclude<TypePill, "all">, string[]> = {
  design: ["design", "content"],
  dev: ["dev"],
  qa: ["qa"],
};

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function isSupportTask(t: PmTask): boolean {
  const tags = Array.isArray((t as any).tags) ? (t as any).tags as string[] : [];
  if (tags.includes("support")) return true;
  const cf = (t as any).custom_fields;
  return !!(cf && cf.is_support);
}

export function TasksTab({ tasks, deps = [], projectId, meId, templateId, onAddTask, onAddRaid, supportMode }: {
  tasks: PmTask[]; deps?: PmDependency[]; projectId: string; meId: string | null; templateId?: string | null;
  onAddTask?: () => void;
  onAddRaid?: (kind: Extract<TaskKind, "decision" | "issue">) => void;
  supportMode?: boolean;
}) {
  const navigate = useNavigate();
  const [view, setView] = useViewMode(`project.tasks.${projectId}`, "list");
  const isMobile = useIsMobile();
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(() => {
    try { return (localStorage.getItem(`pm.tasks.sort.${projectId}`) as "newest" | "oldest") || "newest"; } catch { return "newest"; }
  });
  const [pill, setPill] = useState<TypePill>("all");
  const [kindFilter, setKindFilter] = useState<TaskKind | "all">("all");
  const [watchingOnly, setWatchingOnly] = useState(false);
  const [taskFilter, setTaskFilter] = useState<ProjectTaskFilter | null>(() => readInitialTaskFilter());
  const { isMe, setMode: setMeMode } = useMeMode();
  const watchedTaskIds = useWatchedTaskIds(meId, tasks);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [pendingPageRemoval, setPendingPageRemoval] = useState<{ key: string; label: string; count: number } | null>(null);
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<Map<string, string>>(new Map()); // groupKey -> taskId
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectRange = useCallback((groupKey: string, orderedIds: string[], id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      const anchor = lastClickedRef.current.get(groupKey);
      const i = orderedIds.indexOf(id);
      const a = anchor ? orderedIds.indexOf(anchor) : -1;
      if (i === -1 || a === -1) { if (next.has(id)) next.delete(id); else next.add(id); }
      else {
        const [lo, hi] = a < i ? [a, i] : [i, a];
        for (let k = lo; k <= hi; k++) next.add(orderedIds[k]);
      }
      return next;
    });
    lastClickedRef.current.set(groupKey, id);
  }, []);
  const setGroupSelected = useCallback((ids: string[], on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of ids) { if (on) next.add(id); else next.delete(id); }
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(s => (s.size ? new Set() : s));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
  function toggleSort() {
    setSortOrder(v => {
      const nv = v === "newest" ? "oldest" : "newest";
      try { localStorage.setItem(`pm.tasks.sort.${projectId}`, nv); } catch {}
      return nv;
    });
  }

  const hiddenIds = useMemo(() => computeHiddenTaskIds(tasks, deps), [tasks, deps]);
  const upcomingCount = useMemo(
    () => tasks.filter(t => hiddenIds.has(t.id)).length,
    [tasks, hiddenIds],
  );

  const team = useTeamFilter(`project.${projectId}`);

  // When the project is in Support mode, only "support" tasks drive the board.
  // Build-phase tasks slide to an archive below.
  const activeSource = useMemo(
    () => supportMode ? tasks.filter(isSupportTask) : tasks,
    [tasks, supportMode],
  );
  const buildArchive = useMemo(
    () => supportMode ? tasks.filter(t => !isSupportTask(t)) : [],
    [tasks, supportMode],
  );
  const [archiveOpen, setArchiveOpen] = useState(false);

  const filtered = useMemo(() => {
    // Safety net: if hiding upcoming would leave nothing visible, override and show all.
    const effectiveShowUpcoming = showUpcoming || (activeSource.length > 0 && activeSource.every(t => hiddenIds.has(t.id)));
    let out = activeSource;
    if (!effectiveShowUpcoming) out = out.filter(t => !hiddenIds.has(t.id));
    if (pill !== "all") out = out.filter(t => TYPE_FILTER[pill].includes(t.type));
    // RAID visibility rules:
    //  - kindFilter="all" → hide decisions/risks from board (they live in RaidStrip)
    //  - kindFilter="task" | "decision" | "issue" → strict filter, no auto-hide
    if (kindFilter === "all") out = out.filter(t => getTaskKind(t) === "task");
    else out = out.filter(t => getTaskKind(t) === kindFilter);
    if (isMe && meId) out = out.filter(t => t.assignee_id === meId);
    if (watchingOnly) out = out.filter(t => watchedTaskIds.has(t.id));
    if (taskFilter) out = out.filter(t => matchesTaskFilter(t, taskFilter));
    out = out.filter(t => team.filterTask(t));
    return out;
  }, [activeSource, pill, kindFilter, isMe, meId, hiddenIds, showUpcoming, team, watchingOnly, watchedTaskIds, taskFilter]);

  const sortedFiltered = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return sorted;
  }, [filtered, sortOrder]);

  const byGroup = useMemo(() => {
    const m: Record<StatusGroupId, PmTask[]> = { ready: [], claimed: [], in_progress: [], in_review: [], complete: [] };
    for (const t of sortedFiltered) m[groupIdFor(t.status)].push(t);
    return m;
  }, [sortedFiltered]);

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
      const targetList = updated.filter(t => groupIdFor(t.status) === overContainer && t.id !== active.id);
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
      if (overTask) overContainer = groupIdFor(overTask.status);
    }
    if (!overContainer) { snapshotRef.current = null; return; }

    const originalContainer = groupIdFor(originalTask.status);
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
      const colIds = snapshot.filter(t => groupIdFor(t.status) === originalContainer).map(t => t.id);
      const oldIdx = colIds.indexOf(activeId);
      const newIdx = colIds.indexOf(overId);
      const reorderedIds = (oldIdx !== -1 && newIdx !== -1) ? arrayMove(colIds, oldIdx, newIdx) : colIds;
      const colMap = new Map(snapshot.map(t => [t.id, t]));
      let r = 0;
      nextTasks = snapshot.map(t =>
        groupIdFor(t.status) === originalContainer ? colMap.get(reorderedIds[r++])! : t,
      );
    } else {
      // Cross-column move (or drop-on-column): insert at end of target column.
      const targetColIds = snapshot.filter(t => groupIdFor(t.status) === overContainer && t.id !== activeId).map(t => t.id);
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
        const list = nextTasks.filter(t => groupIdFor(t.status) === gid);
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

  const changeStatus = useCallback(async (taskId: string, gid: StatusGroupId) => {
    let prev: PmTask[] | null = null;
    let newStatus: TaskStatus | null = null;
    setBoardTasks(current => {
      prev = current;
      const task = current.find(t => t.id === taskId);
      if (!task) return current;
      const targetGroup = STATUS_GROUPS.find(g => g.id === gid)!;
      if (targetGroup.statuses.includes(task.status)) return current;
      newStatus = GROUP_PRIMARY_STATUS[gid];
      return current.map(t => t.id === taskId ? { ...t, status: newStatus! } : t);
    });
    if (!newStatus) return;
    const { error } = await supabase.from("pm_tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      if (prev) setBoardTasks(prev);
      toast.error("Couldn't update status");
    }
  }, []);

  const changeDate = useCallback(async (taskId: string, iso: string | null) => {
    let prev: PmTask[] | null = null;
    setBoardTasks(current => {
      prev = current;
      return current.map(t => t.id === taskId ? { ...t, due_date: iso } : t);
    });
    const { error } = await supabase.from("pm_tasks").update({ due_date: iso }).eq("id", taskId);
    if (error) {
      if (prev) setBoardTasks(prev);
      toast.error("Couldn't update date");
    }
  }, []);

  const pills: { id: TypePill | "me"; label: string; teamColor?: string }[] = [
    { id: "all", label: "All" },
    { id: "design", label: "Design", teamColor: TEAM_COLORS.design },
    { id: "dev", label: "Dev", teamColor: TEAM_COLORS.dev },
    { id: "qa", label: "QA", teamColor: TEAM_COLORS.qa },
    { id: "me", label: "My Tasks" },
  ];

  function chipCls(active: boolean) {
    return `h-7 px-3 rounded-full text-xs font-medium border transition inline-flex items-center gap-1.5 ${
      active ? "bg-info/10 text-info border-info" : "bg-background text-muted-foreground border-border hover:bg-muted"
    }`;
  }

  const openTask = useCallback((id: string) => navigate(`/pm/tasks/${id}`), [navigate]);
  const orderedByGroupRef = useRef<Map<string, string[]>>(new Map());
  const handleRowToggle = useCallback((id: string, e?: React.MouseEvent, groupKey?: string) => {
    if (e?.shiftKey && groupKey) {
      const ids = orderedByGroupRef.current.get(groupKey) ?? [];
      selectRange(groupKey, ids, id);
    } else {
      toggleSelect(id);
    }
  }, [toggleSelect, selectRange]);

  return (
    <div className="space-y-3">
      {/* RAID strip — always at top when there are open decisions/risks */}
      <RaidStrip tasks={activeSource} onLog={(k) => onAddRaid?.(k)} />

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
        {meId && (
          <button
            type="button"
            className={chipCls(watchingOnly)}
            onClick={() => setWatchingOnly(v => !v)}
            title="Show only tasks you're watching"
          >
            <Eye className="h-3 w-3" />
            Watching
            {watchedTaskIds.size > 0 && (
              <span className="ml-1 text-[10px] opacity-70">{watchedTaskIds.size}</span>
            )}
          </button>
        )}
        {taskFilter && (
          <button
            type="button"
            className={chipCls(true)}
            onClick={() => setTaskFilter(null)}
            title="Clear this filter"
          >
            {TASK_FILTER_LABEL[taskFilter]} only
            <X className="h-3 w-3 ml-1" />
          </button>
        )}
        {/* Kind filter (RAID log): Tasks only (default) / Decisions / Risks / Everything */}
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1 py-0.5">
          {(["all", ...TASK_KINDS] as const).map(k => {
            const active = kindFilter === k;
            const label = k === "all" ? "Show all" : k === "task" ? "Tasks" : KIND_META[k].short;
            const Icon = k === "all" ? null : KIND_META[k].icon;
            const color = k === "all" ? undefined : KIND_META[k].dotHsl;
            const title =
              k === "all" ? "Show tasks + RAID items inline in the board"
              : k === "task" ? "Only tasks (default) — RAID lives in the strip above"
              : KIND_META[k as TaskKind].description;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`h-6 px-2 rounded-full text-[11px] font-medium inline-flex items-center gap-1 transition ${
                  active ? "bg-info/10 text-info" : "text-muted-foreground hover:bg-muted"
                }`}
                title={title}
              >
                {Icon && <Icon className="h-3 w-3" style={{ color }} />}
                {label}
              </button>
            );
          })}
        </div>

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
          <button
            type="button"
            onClick={toggleSort}
            className={chipCls(false)}
            title={sortOrder === "newest" ? "Sort: newest first" : "Sort: oldest first"}
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortOrder === "newest" ? "Newest" : "Oldest"}
          </button>
          <div className="flex gap-1">
            <button type="button" className={chipCls(view === "list")} onClick={() => setView("list")}>List</button>
            <button type="button" className={chipCls(view === "kanban")} onClick={() => setView("kanban")}>Board</button>
          </div>
        </div>
      </div>

      <BulkTaskActions selected={selected} onClear={clearSelection} onChanged={emitTasksChanged} />

      {/* Pages (grouped) */}
      {view === "list" && (() => {
        const pageMap = new Map<string, { label: string; tasks: PmTask[] }>();
        for (const t of sortedFiltered) {
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
                        onClick={() => setPendingPageRemoval({ key, label, count: pageTasks.length })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {!isC && (
                      <div className="px-2 pb-2 space-y-1">
                        {pageTasks.map(t => {
                          const g = groupForStatus(t.status);
                          const groupKey = `page:${key}`;
                          return <TaskRow key={t.id} task={t} groupKey={groupKey} groupColorBg={g.bg} count={counts.get(t.id)} onOpen={openTask} selected={selected.has(t.id)} onToggleSelect={handleRowToggle} />;
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
          {PROJECT_GROUPS.map(g => {
            const list = byGroup[g.id];
            const isCollapsed = collapsed[g.id];
            const groupKey = `list:${g.id}`;
            const ids = list.map(t => t.id);
            orderedByGroupRef.current.set(groupKey, ids);
            const selectedCount = ids.reduce((n, id) => n + (selected.has(id) ? 1 : 0), 0);
            const allSelected = ids.length > 0 && selectedCount === ids.length;
            const someSelected = selectedCount > 0 && !allSelected;
            return (
              <Card key={g.id}>
                <CardContent className="p-2">
                  <div className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40">
                    {ids.length > 0 && (
                      <span onClick={(e) => e.stopPropagation()} className={selectedCount > 0 ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}>
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(v) => setGroupSelected(ids, !!v)}
                          aria-label={`Select all ${g.label}`}
                        />
                      </span>
                    )}
                    <button type="button"
                      className="flex-1 flex items-center gap-2"
                      onClick={() => setCollapsed(c => ({ ...c, [g.id]: !c[g.id] }))}>
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                      <span className={`text-[12px] font-semibold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                      <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{list.length}</span>
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-1 mt-1">
                      {list.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground italic">No tasks</div>
                      )}
                      {list.map(t => (
                        <TaskRow key={t.id} task={t} groupKey={groupKey} groupColorBg={g.bg} count={counts.get(t.id)} onOpen={openTask} selected={selected.has(t.id)} onToggleSelect={handleRowToggle} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Board — mobile: stacked single-column sections, no drag-and-drop.
          Status changes happen via the status picker on each card. */}
      {view === "kanban" && isMobile && (
        <DndContext>
          <div className="space-y-4">
            {PROJECT_GROUPS.map(g => {
              const list = boardByGroup[g.id];
              const gk = `board:${g.id}`;
              orderedByGroupRef.current.set(gk, list.map(t => t.id));
              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`text-[12px] font-semibold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                    <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{list.length}</span>
                  </div>
                  {list.length === 0 && (
                    <div className="px-1 text-xs italic text-muted-foreground">No tasks</div>
                  )}
                  {list.map(t => (
                    <BoardTaskCard
                      key={t.id}
                      task={t}
                      groupKey={gk}
                      count={counts.get(t.id)}
                      onOpen={openTask}
                      onStatusChange={changeStatus}
                      onDateChange={changeDate}
                      allTasks={boardTasks}
                      deps={deps}
                      isProject
                      selected={selected.has(t.id)}
                      onToggleSelect={handleRowToggle}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </DndContext>
      )}

      {view === "kanban" && !isMobile && (
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
          <div className="flex md:grid md:grid-cols-4 gap-3 touch-scroll-x md:!overflow-visible no-scrollbar snap-x snap-mandatory md:snap-none -mx-3 px-3 md:mx-0 md:px-0 [&>*]:w-[85vw] [&>*]:flex-shrink-0 [&>*]:snap-center md:[&>*]:w-auto">
            {PROJECT_GROUPS.map(g => (
              <BoardColumn key={g.id} group={g} tasks={boardByGroup[g.id]} isDragActive={activeId !== null}>
                {(() => {
                  const gk = `board:${g.id}`;
                  const ids = boardByGroup[g.id].map(t => t.id);
                  orderedByGroupRef.current.set(gk, ids);
                  return boardByGroup[g.id].map(t => (
                    <BoardTaskCard
                      key={t.id}
                      task={t}
                      groupKey={gk}
                      count={counts.get(t.id)}
                      onOpen={openTask}
                      onStatusChange={changeStatus}
                      onDateChange={changeDate}
                      allTasks={boardTasks}
                      deps={deps}
                      isProject
                      selected={selected.has(t.id)}
                      onToggleSelect={handleRowToggle}
                    />
                  ));
                })()}
              </BoardColumn>
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <BoardTaskCard
                task={activeTask}
                count={counts.get(activeTask.id)}
                onOpen={() => {}}
                onStatusChange={() => {}}
                onDateChange={() => {}}
                allTasks={boardTasks}
                deps={deps}
                isProject
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Build Archive — visible only in Support mode. Grayed, collapsed by default. */}
      {supportMode && buildArchive.length > 0 && (
        <Card className="opacity-80">
          <CardContent className="p-2">
            <button
              type="button"
              onClick={() => setArchiveOpen(o => !o)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${archiveOpen ? "rotate-90" : ""}`} />
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Build archive
              </span>
              <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">
                {buildArchive.length}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground italic">
                Original project tasks — read-only history
              </span>
            </button>
            {archiveOpen && (
              <div className="mt-1 space-y-1 grayscale opacity-70">
                {[...buildArchive]
                  .sort((a, b) => {
                    const da = new Date(a.created_at).getTime();
                    const db = new Date(b.created_at).getTime();
                    if (da !== db) return sortOrder === "newest" ? db - da : da - db;
                    const ai = STATUS_GROUPS.findIndex(g => g.statuses.includes(a.status));
                    const bi = STATUS_GROUPS.findIndex(g => g.statuses.includes(b.status));
                    return ai - bi;
                  })
                  .map(t => {
                    const g = groupForStatus(t.status);
                    return (
                      <TaskRow
                        key={t.id}
                        task={t}
                        groupColorBg={g.bg}
                        count={counts.get(t.id)}
                        onOpen={openTask}
                      />
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {templateId && (
        <AddPageDialog projectId={projectId} templateId={templateId} open={addPageOpen} onOpenChange={setAddPageOpen} />
      )}

      <ConfirmDialog
        open={!!pendingPageRemoval}
        onOpenChange={(o) => { if (!o) setPendingPageRemoval(null); }}
        title="Remove this page?"
        description={pendingPageRemoval
          ? `"${pendingPageRemoval.label}" and its ${pendingPageRemoval.count} task(s) will be deleted. This cannot be undone.`
          : undefined}
        confirmLabel="Remove page"
        onConfirm={async () => {
          if (!pendingPageRemoval) return;
          await removePageFromProject(projectId, pendingPageRemoval.key);
          emitTasksChanged();
          toast.success(`Removed ${pendingPageRemoval.label}`);
          setPendingPageRemoval(null);
        }}
      />
    </div>
  );
}

const TaskRow = memo(function TaskRow({ task, groupKey, groupColorBg, count, onOpen, selected, onToggleSelect }: {
  task: PmTask; groupKey?: string; groupColorBg: string; count?: SubtaskCount;
  onOpen: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string, e?: React.MouseEvent, groupKey?: string) => void;
}) {
  const preview = stripHtml(task.description);
  const teams = (Array.isArray((task as any).teams) ? (task as any).teams : []) as string[];
  return (
    <div
      onClick={() => onOpen(task.id)}
      className="flex items-center gap-3 pl-0 pr-3 py-1.5 rounded border border-transparent cursor-pointer transition hover:border-info group"
    >
      {onToggleSelect && (
        <span
          onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id, e, groupKey); }}
          className={`pl-2 ${selected ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
        >
          <Checkbox checked={!!selected} aria-label="Select task" tabIndex={-1} />
        </span>
      )}
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
      <span onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <TaskTriagePopover task={task} hideClaimed />
      </span>
    </div>
  );
});

function TeamPillInline({ team }: { team: string }) {
  const c = TEAM_COLORS[team as Team] ?? "hsl(var(--muted-foreground))";
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium" style={{ borderColor: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      <span className="capitalize">{team}</span>
    </span>
  );
}


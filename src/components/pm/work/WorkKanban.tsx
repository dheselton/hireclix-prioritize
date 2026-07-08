import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { StatusPill } from "@/components/pm/StatusPill";
import { fmtDateShort } from "@/lib/pm/format";
import type { PmTask, PmProject, TaskStatus } from "@/types/pm";
import { cn } from "@/lib/utils";

const COL_LABELS: Record<TaskStatus, string> = {
  unclaimed: "Unclaimed", claimed: "Claimed", in_progress: "In Progress", blocked: "Blocked",
  in_review: "In Review", approved: "Approved", complete: "Complete",
};

export function WorkKanban({
  tasks, columns, projects, onOpen, onMove,
}: {
  tasks: PmTask[];
  columns: TaskStatus[];
  projects: Map<string, PmProject>;
  onOpen: (id: string) => void;
  onMove: (taskId: string, status: TaskStatus) => Promise<void> | void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Optimistic overlay of status per task while persisting.
  const [override, setOverride] = useState<Record<string, TaskStatus>>({});

  const displayTasks = useMemo(
    () => tasks.map(t => (override[t.id] ? { ...t, status: override[t.id] } : t)),
    [tasks, override],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = activeId ? displayTasks.find(t => t.id === activeId) ?? null : null;

  function findColumn(id: string): TaskStatus | null {
    if (id.startsWith("col:")) return id.slice(4) as TaskStatus;
    const t = displayTasks.find(x => x.id === id);
    return t ? t.status : null;
  }

  function handleDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const fromCol = findColumn(String(active.id));
    const toCol = findColumn(String(over.id));
    if (!fromCol || !toCol || fromCol === toCol) return;
    const id = String(active.id);
    setOverride(o => ({ ...o, [id]: toCol }));
    try { await onMove(id, toCol); }
    finally {
      // Drop override after data refreshes (parent reload will re-seed tasks).
      setTimeout(() => setOverride(o => { const n = { ...o }; delete n[id]; return n; }), 500);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 touch-scroll-x no-scrollbar snap-x snap-mandatory md:snap-none pb-3 -mx-3 px-3 md:mx-0 md:px-0">
        {columns.map(s => {
          const items = displayTasks.filter(t => t.status === s);
          return (
            <KColumn key={s} status={s} count={items.length}>
              <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {items.map(t => (
                  <KCard key={t.id} task={t} project={projects.get(t.project_id)} onOpen={onOpen} />
                ))}
              </SortableContext>
            </KColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? <KCard task={activeTask} project={projects.get(activeTask.project_id)} onOpen={() => {}} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KColumn({ status, count, children }: { status: TaskStatus; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <div className="flex-shrink-0 w-[85vw] sm:w-72 snap-center md:snap-align-none bg-muted/30 rounded-lg p-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide">{COL_LABELS[status]}</div>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      <div ref={setNodeRef} className={cn("space-y-2 min-h-[120px] rounded-md p-1 border border-dashed transition-colors",
        isOver ? "bg-info/5 border-info" : "border-transparent")}>
        {children}
      </div>
    </div>
  );
}

function KCard({ task, project, onOpen, overlay }: {
  task: PmTask; project?: PmProject; onOpen: (id: string) => void; overlay?: boolean;
}) {
  const sortable = useSortable({ id: task.id, disabled: overlay });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = overlay ? undefined : { transform: CSS.Transform.toString(transform), transition };
  const blocked = task.status === "blocked";
  return (
    <div ref={overlay ? undefined : setNodeRef} style={style} {...(overlay ? {} : attributes)} {...(overlay ? {} : listeners)}
      className={isDragging && !overlay ? "opacity-40" : ""}>
      <Card onClick={() => onOpen(task.id)}
        className={cn("cursor-pointer hover:shadow-md transition", blocked && "border-red-500/60", overlay && "shadow-lg")}>
        <CardContent className="p-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <PriorityFlag priority={task.priority} size="xs" className="mt-0.5" />
            <div className="text-sm font-medium leading-tight flex-1 line-clamp-2">{task.title}</div>
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" muted={task.status === "unclaimed"} />
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusPill status={task.status} className="text-[10px] py-0 px-1.5" />
            <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
          </div>
          {project && <div className="text-[11px] text-muted-foreground truncate">{project.title}</div>}
          {blocked && task.dev_blocker && <div className="text-[11px] text-red-600 italic">⚠ {task.dev_blocker}</div>}
          <div className="flex items-center justify-end pt-1">
            <span className="text-[11px] text-muted-foreground">{fmtDateShort(task.due_date)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

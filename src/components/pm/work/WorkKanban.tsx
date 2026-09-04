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
import type { PmTask, PmProject, TaskStatus } from "@/types/pm";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientContext } from "@/components/pm/ClientContext";
import { DueBadge } from "@/components/pm/DueBadge";
import { dueAccentClass } from "@/lib/pm/dueState";
import { clientNameForProject, useClientNamesMap } from "@/lib/pm/clients";
import { AttributionChip } from "@/components/pm/AttributionChip";

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
  const isMobile = useIsMobile();



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

  async function moveTask(id: string, to: TaskStatus) {
    setOverride(o => ({ ...o, [id]: to }));
    try { await onMove(id, to); }
    finally {
      setTimeout(() => setOverride(o => { const n = { ...o }; delete n[id]; return n; }), 500);
    }
  }



  // Mobile: no drag-and-drop — stacked sections with a per-card status select.
  if (isMobile) {
    return (
      <div className="space-y-4">
        {columns.map(s => {
          const items = displayTasks.filter(t => t.status === s);
          return (
            <div key={s} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-semibold uppercase tracking-wide">{COL_LABELS[s]}</div>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>
              {items.length === 0 && (
                <div className="px-1 text-xs italic text-muted-foreground">No tasks</div>
              )}
              {items.map(t => (
                <MobileCard
                  key={t.id}
                  task={t}
                  project={projects.get(t.project_id)}
                  columns={columns}
                  onOpen={onOpen}
                  onMove={moveTask}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
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
  const clientNames = useClientNamesMap();
  return (
    <div ref={overlay ? undefined : setNodeRef} style={style} {...(overlay ? {} : attributes)} {...(overlay ? {} : listeners)}
      className={isDragging && !overlay ? "opacity-40" : ""}>
      <Card onClick={() => onOpen(task.id)}
        className={cn(
          "cursor-pointer hover:shadow-md transition",
          blocked && "border-red-500/60",
          overlay && "shadow-lg",
          dueAccentClass(task),
        )}>
        <CardContent className="p-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <PriorityFlag priority={task.priority} size="xs" className="mt-0.5" />
            <div className="text-sm font-medium leading-tight flex-1 line-clamp-2">{task.title}</div>
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" muted={task.status === "unclaimed"} />
            </span>
          </div>
          <ClientContext
            clientName={clientNameForProject(project, clientNames)}
            clientId={project?.client_id}
            projectTitle={project?.title}
            taskTitle={task.title}
          />
          <AttributionChip
            created_by={task.created_by}
            creation_source={task.creation_source}
            creation_context={task.creation_context}
            requested_by={project?.requested_by}
            className="max-w-full"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusPill status={task.status} className="text-[10px] py-0 px-1.5" />
            <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
          </div>
          {blocked && task.dev_blocker && <div className="text-[11px] text-red-600 italic">⚠ {task.dev_blocker}</div>}
          <div className="flex items-center justify-end pt-1">
            <DueBadge dueDate={task.due_date} status={task.status} dueDateChanges={task.due_date_changes} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Mobile card: same content as KCard, no drag; status changes via a select. */
function MobileCard({ task, project, columns, onOpen, onMove }: {
  task: PmTask;
  project?: PmProject;
  columns: TaskStatus[];
  onOpen: (id: string) => void;
  onMove: (id: string, status: TaskStatus) => void;
}) {
  const blocked = task.status === "blocked";
  const options = columns.includes(task.status) ? columns : [task.status, ...columns];
  const clientNames = useClientNamesMap();
  return (
    <Card className={cn("w-full", blocked && "border-red-500/60", dueAccentClass(task))}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2" onClick={() => onOpen(task.id)}>
          <PriorityFlag priority={task.priority} size="xs" className="mt-0.5" />
          <div className="text-sm font-medium leading-tight flex-1">{task.title}</div>
          <span onClick={(e) => e.stopPropagation()} className="shrink-0">
            <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" muted={task.status === "unclaimed"} />
          </span>
        </div>
        <ClientContext
          clientName={clientNameForProject(project, clientNames)}
          clientId={project?.client_id}
          projectTitle={project?.title}
          taskTitle={task.title}
        />
        <AttributionChip
          created_by={task.created_by}
          creation_source={task.creation_source}
          creation_context={task.creation_context}
          requested_by={project?.requested_by}
          className="max-w-full"
        />
        {blocked && task.dev_blocker && <div className="text-[11px] text-red-600 italic">⚠ {task.dev_blocker}</div>}
        <div className="flex items-center gap-2">
          <Select value={task.status} onValueChange={(v) => onMove(task.id, v as TaskStatus)}>
            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {options.map(s => <SelectItem key={s} value={s} className="text-xs">{COL_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <DueBadge dueDate={task.due_date} status={task.status} dueDateChanges={task.due_date_changes} />
        </div>
      </CardContent>
    </Card>
  );
}

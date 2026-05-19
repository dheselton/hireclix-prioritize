import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { StatusGroupDef } from "@/lib/pm/statusGroups";
import type { PmTask } from "@/types/pm";

export function BoardColumn({
  group,
  tasks,
  isDragActive,
  children,
}: {
  group: StatusGroupDef;
  tasks: PmTask[];
  isDragActive: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${group.id}` });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className={`text-[12px] font-semibold uppercase tracking-wide ${group.text}`}>{group.label}</span>
        <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] rounded-md p-1 border border-dashed transition-colors ${
          isDragActive && isOver
            ? "bg-info/5 border-info"
            : "border-transparent"
        }`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>
    </div>
  );
}

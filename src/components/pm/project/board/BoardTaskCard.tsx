import { Card, CardContent } from "@/components/ui/card";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { AvatarStack } from "@/components/pm/AvatarStack";
import { useProjectTeam } from "@/lib/pm/projectTeam";
import { useInternalProjectIds, useCareerSiteProjects, careerSiteSubtype } from "@/lib/pm/clients";
import { typeBadgeClass } from "@/lib/pm/statusGroups";
import { groupForStatus } from "@/lib/pm/statusGroups";
import type { PmTask } from "@/types/pm";
import type { SubtaskCount } from "@/components/pm/SubtaskBadge";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatusPickerPopover } from "./StatusPickerPopover";
import { InlineDatePopover } from "./InlineDatePopover";
import type { StatusGroupId } from "@/lib/pm/statusGroups";

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function BoardTaskCard({
  task,
  count,
  onClick,
  onStatusChange,
  onDateChange,
  overlay,
}: {
  task: PmTask;
  count?: SubtaskCount;
  onClick: () => void;
  onStatusChange: (g: StatusGroupId) => void;
  onDateChange: (iso: string | null) => void;
  overlay?: boolean;
}) {
  const sortable = useSortable({ id: task.id, disabled: overlay });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = overlay
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition };
  const preview = stripHtml(task.description);
  const group = groupForStatus(task.status);
  const team = useProjectTeam(task.project_id);
  const internalProjects = useInternalProjectIds();
  const careersiteProjects = useCareerSiteProjects();
  const isInternal = internalProjects.has(task.project_id);
  const csRequestType = careersiteProjects.get(task.project_id) ?? null;
  const isCareerSite = !!csRequestType;
  const csLabel = isCareerSite ? careerSiteSubtype({ request_type: csRequestType }) : null;
  const unclaimed = task.status === "unclaimed";

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={isDragging && !overlay ? "opacity-40" : ""}
    >
      <Card
        onClick={onClick}
        className={`card-lift cursor-pointer border border-border ${overlay ? "opacity-80 shadow-lg" : ""} ${isCareerSite ? "careersite-border-l" : isInternal ? "internal-border-l" : unclaimed ? "border-l-4 border-l-amber-500" : ""}`}
      >
        <CardContent className="p-3 space-y-2 flex flex-col">
          <div className="flex items-start gap-2">
            <div className="text-[12px] font-bold leading-snug line-clamp-2 flex-1">{task.title}</div>
            {isInternal && <span className="internal-pill shrink-0">Internal</span>}
            {isCareerSite && (
              <span className="careersite-pill shrink-0">CS{csLabel ? ` · ${csLabel}` : ""}</span>
            )}
          </div>
          {preview && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{preview}</p>
          )}
          <div className="flex items-center gap-2">
            <span className={`inline-block text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
              {task.type}
            </span>
            {count && count.total > 0 && (
              <span className="text-[11px] text-muted-foreground">{count.done}/{count.total} subtasks</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
            <StatusPickerPopover currentGroup={group.id} onPick={onStatusChange} />
            <div className="flex items-center gap-2">
              <InlineDatePopover value={task.due_date} onChange={onDateChange} />
              {team.length > 1 && (
                <AvatarStack userIds={team} max={3} size="xs" highlightId={task.assignee_id} muted={unclaimed} />
              )}
              {team.length <= 1 && (
                <AssigneePopover taskId={task.id} assigneeId={task.assignee_id} size="xs" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { AvatarStack } from "@/components/pm/AvatarStack";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { StatusPill } from "@/components/pm/StatusPill";
import { TeamColorBar } from "@/components/pm/TeamColorBar";
import { TeamPill } from "@/components/pm/TeamsMultiSelect";
import { WaitingChip } from "@/components/pm/WaitingChip";
import { useProjectTeam } from "@/lib/pm/projectTeam";
import { useInternalProjectIds, useCareerSiteProjects, careerSiteSubtype } from "@/lib/pm/clients";
import { groupForStatus } from "@/lib/pm/statusGroups";
import { computeTaskVisualState } from "@/lib/pm/taskVisualState";
import { useCurrentUser } from "@/lib/pm/mockUser";
import type { PmTask, PmDependency } from "@/types/pm";
import type { SubtaskCount } from "@/components/pm/SubtaskBadge";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatusPickerPopover } from "./StatusPickerPopover";
import { InlineDatePopover } from "./InlineDatePopover";
import type { StatusGroupId } from "@/lib/pm/statusGroups";
import { cn } from "@/lib/utils";
import { TagPillList } from "@/components/pm/tags/TagPill";
import { KindBadge } from "@/components/pm/tasks/KindBadge";
import { TimeTotalBadge } from "@/components/pm/time/TimeTotalBadge";
import { getTaskKind, getKindGroupLabel } from "@/lib/pm/taskKind";
import { AttributionChip } from "@/components/pm/AttributionChip";


function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export type BoardTaskCardProps = {
  task: PmTask;
  count?: SubtaskCount;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, g: StatusGroupId) => void;
  onDateChange: (id: string, iso: string | null) => void;
  overlay?: boolean;
  allTasks?: PmTask[];
  deps?: PmDependency[];
  isProject?: boolean;
  selected?: boolean;
  groupKey?: string;
  onToggleSelect?: (id: string, e?: React.MouseEvent, groupKey?: string) => void;
};

function BoardTaskCardInner({
  task,
  count,
  onOpen,
  onStatusChange,
  onDateChange,
  overlay,
  allTasks,
  deps,
  isProject = false,
  selected,
  groupKey,
  onToggleSelect,
}: BoardTaskCardProps) {
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
  const { user, roles } = useCurrentUser();
  const isPM = roles.includes("pm");
  const isDone = task.status === "complete" || task.status === "approved";
  const needsAssignee = isProject && !task.assignee_id && !isDone;
  const mutedNoOwner = !isProject && unclaimed;

  const vis = computeTaskVisualState(task, allTasks ?? [], deps ?? [], {
    meId: user?.id ?? null,
    bypassWaiting: isPM,
  });
  const showTeamBar = !isCareerSite && !isInternal && !!vis.teamBarBackground;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={cn(isDragging && !overlay ? "opacity-40" : "", "group/card")}
    >
      <Card
        onClick={() => onOpen(task.id)}
        className={cn(
          "relative overflow-hidden card-lift cursor-pointer border border-border",
          overlay && "opacity-80 shadow-lg",
          isCareerSite && "careersite-border-l",
          !isCareerSite && isInternal && "internal-border-l",
          vis.waiting && "task-waiting",
          needsAssignee && !vis.waiting && "task-needs-assignee",
          selected && "outline outline-2 outline-info -outline-offset-2",
        )}
      >
        {showTeamBar && <TeamColorBar background={vis.teamBarBackground} dim={vis.waiting} />}
        {onToggleSelect && !overlay && (
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id, e, groupKey); }}
            className={cn(
              "absolute top-1.5 right-1.5 z-10 rounded bg-background/90 backdrop-blur p-1 border border-border transition-opacity",
              selected ? "opacity-100" : "touch-action",
            )}
          >
            <Checkbox checked={!!selected} aria-label="Select task" tabIndex={-1} className="pointer-events-none" />
          </span>
        )}
        <CardContent className={cn("p-3 space-y-2 flex flex-col", showTeamBar && "pl-4")}>
          <div className="flex items-start gap-2">
            <PriorityFlag priority={task.priority} size="xs" className="mt-0.5" />
            <div className={cn(
              "text-[12px] leading-snug line-clamp-2 flex-1",
              vis.waiting ? "font-medium text-muted-foreground" : "font-bold",
            )}>
              {task.title}
            </div>
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" muted={mutedNoOwner || vis.waiting} />
            </span>
          </div>
          {(() => {
            const kind = getTaskKind(task);
            const groupLabel = getKindGroupLabel(group.id, kind) ?? group.label;
            return (
              <>
                <KindBadge kind={kind} />
                {preview && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{preview}</p>
                )}
                {vis.waiting && (
                  <div className="text-[10px] text-muted-foreground italic truncate">{vis.waitingReason}</div>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {vis.waiting ? (
                    <WaitingChip reason={vis.waitingReason} />
                  ) : isProject ? (
                    <span className={cn("text-[10px] py-0 px-1.5 rounded-full font-medium", group.text, "bg-muted")}>
                      {groupLabel}
                    </span>
                  ) : (
                    <StatusPill status={task.status} kind={kind} className="text-[10px] py-0 px-1.5" />
                  )}
                  {vis.teams.map(t => <TeamPill key={t} team={t} />)}
                  <span className="text-[10px] text-muted-foreground lowercase">· {task.type}</span>
                  {isInternal && <span className="internal-pill shrink-0">Internal</span>}
                  {isCareerSite && (
                    <span className="careersite-pill shrink-0">CS{csLabel ? ` · ${csLabel}` : ""}</span>
                  )}
                  {count && count.total > 0 && (
                    <span className="text-[11px] text-muted-foreground">{count.done}/{count.total} subtasks</span>
                  )}
                  <TimeTotalBadge taskId={task.id} />
                </div>
                <TagPillList tags={task.tags ?? []} max={3} />
                <AttributionChip
                  created_by={task.created_by}
                  creation_source={task.creation_source}
                  creation_context={task.creation_context}
                  className="max-w-full"
                />
                <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
                  <StatusPickerPopover
                    currentGroup={group.id}
                    onPick={(g) => onStatusChange(task.id, g)}
                    hideClaimed={isProject}
                    kind={kind}
                  />
                  <div className="flex items-center gap-2">
                    <InlineDatePopover value={task.due_date} onChange={(iso) => onDateChange(task.id, iso)} />
                    {team.length > 1 && (
                      <AvatarStack userIds={team} max={3} size="xs" muted={mutedNoOwner || vis.waiting} />
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

export const BoardTaskCard = memo(BoardTaskCardInner);

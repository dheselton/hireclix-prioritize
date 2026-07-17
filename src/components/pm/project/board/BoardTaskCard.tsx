import { Card, CardContent } from "@/components/ui/card";
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
import { getTaskKind, getKindGroupLabel } from "@/lib/pm/taskKind";


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
  allTasks,
  deps,
  isProject = false,
  selected,
  onToggleSelect,
}: {
  task: PmTask;
  count?: SubtaskCount;
  onClick: () => void;
  onStatusChange: (g: StatusGroupId) => void;
  onDateChange: (iso: string | null) => void;
  overlay?: boolean;
  allTasks?: PmTask[];
  deps?: PmDependency[];
  isProject?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  const { user } = useCurrentUser();
  const isPM = user?.role === "pm";
  const isDone = task.status === "complete" || task.status === "approved";
  // On project boards we hide the "claimed/unclaimed" concept and instead glow
  // unassigned cards. On request boards we keep the muted "unclaimed" treatment.
  const needsAssignee = isProject && !task.assignee_id && !isDone;
  const mutedNoOwner = !isProject && unclaimed;

  const vis = computeTaskVisualState(task, allTasks ?? [], deps ?? [], {
    meId: user?.id ?? null,
    bypassWaiting: isPM,
  });
  // Project-level borders (careersite > internal) hide the team bar to avoid double accent.
  // Otherwise the team color bar always wins — including for unclaimed tasks (the Unclaimed pill still signals status).
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
        onClick={onClick}
        className={cn(
          "relative overflow-hidden card-lift cursor-pointer border border-border",
          overlay && "opacity-80 shadow-lg",
          isCareerSite && "careersite-border-l",
          !isCareerSite && isInternal && "internal-border-l",
          vis.waiting && "task-waiting",
          needsAssignee && !vis.waiting && "task-needs-assignee",
          selected && "ring-2 ring-info ring-offset-1",
        )}
      >
        {showTeamBar && <TeamColorBar background={vis.teamBarBackground} dim={vis.waiting} />}
        {onToggleSelect && !overlay && (
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={cn(
              "absolute top-1.5 right-1.5 z-10 rounded bg-background/80 backdrop-blur p-0.5 transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
            )}
          >
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect()}
              aria-label="Select task"
              className="h-3.5 w-3.5 cursor-pointer accent-info"
            />
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
                </div>
                <TagPillList tags={task.tags ?? []} max={3} />
                <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
                  <StatusPickerPopover currentGroup={group.id} onPick={onStatusChange} hideClaimed={isProject} kind={kind} />
                  <div className="flex items-center gap-2">
                    <InlineDatePopover value={task.due_date} onChange={onDateChange} />
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

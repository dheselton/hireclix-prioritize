import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/pm/format";
import { StatusPill } from "@/components/pm/StatusPill";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { AvatarStack } from "@/components/pm/AvatarStack";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { TeamColorBar } from "@/components/pm/TeamColorBar";
import { TeamPill } from "@/components/pm/TeamsMultiSelect";
import { useProjectTeam } from "@/lib/pm/projectTeam";
import { useInternalProjectIds, useCareerSiteProjects, careerSiteSubtype } from "@/lib/pm/clients";
import { teamsFromTask } from "@/lib/pm/teams";
import { teamBarBackground } from "@/lib/pm/taskVisualState";
import type { PmTask } from "@/types/pm";
import { TagPillList } from "@/components/pm/tags/TagPill";
import { TimeTotalBadge } from "@/components/pm/time/TimeTotalBadge";
import { AttributionChip } from "@/components/pm/AttributionChip";


interface Props {
  task: PmTask;
  clientName?: string | null;
  /** Title of the live career site this request nests under. */
  parentSiteName?: string | null;
  onOpen: (id: string) => void;
  onChanged?: () => void;
}

function isOverdue(t: PmTask) {
  if (!t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString())
    && t.status !== "complete" && t.status !== "approved";
}

/** Compact, thin card for request-type tasks. Optimized for speed/throughput. */
export function RequestTaskCard({ task, clientName, parentSiteName, onOpen, onChanged }: Props) {
  const overdue = isOverdue(task);
  const team = useProjectTeam(task.project_id);
  const internalProjects = useInternalProjectIds();
  const careersiteProjects = useCareerSiteProjects();
  const isInternal = internalProjects.has(task.project_id);
  const csRequestType = careersiteProjects.get(task.project_id) ?? null;
  const isCareerSite = !!csRequestType;
  const csLabel = isCareerSite ? careerSiteSubtype({ request_type: csRequestType }) : null;
  const unclaimed = task.status === "unclaimed";
  const teams = teamsFromTask(task);
  const teamBg = teamBarBackground(teams);
  const showTeamBar = !!teamBg && !isCareerSite && !isInternal;
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        "relative overflow-hidden card-lift group w-full text-left rounded-md border border-border bg-card px-3 py-2",
        "flex items-center gap-3",
        isInternal && !isCareerSite && "internal-border-l",
        isCareerSite && "careersite-border-l",
        showTeamBar && "pl-4",
      )}
    >

      {showTeamBar && <TeamColorBar background={teamBg} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
          <PriorityFlag priority={task.priority} size="xs" />
          <span className="text-sm font-medium truncate">{task.title}</span>
          <WorkTypeBadge workType="request" compact />
          {teams.map(t => <TeamPill key={t} team={t} />)}

          {isInternal && <span className="internal-pill shrink-0">Internal</span>}
          {isCareerSite && (
            <span className="careersite-pill shrink-0">Career Site{csLabel ? ` · ${csLabel}` : ""}</span>
          )}
          {unclaimed && isCareerSite && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Unclaimed" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground truncate">
          {clientName && <span className="truncate">{clientName}</span>}
          {clientName && parentSiteName && <span>·</span>}
          {parentSiteName && <span className="truncate">Site: {parentSiteName}</span>}
          {(clientName || parentSiteName) && task.due_date && <span>·</span>}
          {task.due_date && (
            <span className={cn(overdue && "text-red-500 font-medium")}>
              Due {fmtDate(task.due_date)}
            </span>
          )}
          <TimeTotalBadge taskId={task.id} size="sm" />
          <TagPillList tags={task.tags ?? []} max={2} />
          <AttributionChip
            created_by={task.created_by}
            creation_source={task.creation_source}
            creation_context={task.creation_context}
            className="ml-auto shrink-0 max-w-[140px]"
          />
        </div>
      </div>
      <StatusPill status={task.status} />
      {unclaimed ? (
        team.length > 0 ? <AvatarStack userIds={team} max={3} size="xs" muted /> : null
      ) : (
        <AvatarStack userIds={team} max={3} size="xs" highlightId={task.assignee_id} />
      )}
      {unclaimed && team.length === 0 && <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" muted />}
      <div onClick={(e) => e.stopPropagation()}>
        <ClaimButton task={task} onChanged={onChanged} />
      </div>
    </button>
  );
}

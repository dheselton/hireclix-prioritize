import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/pm/format";
import { StatusPill } from "@/components/pm/StatusPill";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { AvatarStack } from "@/components/pm/AvatarStack";
import { TeamColorBar } from "@/components/pm/TeamColorBar";
import { TeamPill } from "@/components/pm/TeamsMultiSelect";
import { useProjectTeam } from "@/lib/pm/projectTeam";
import { useInternalProjectIds, useCareerSiteProjects, careerSiteSubtype } from "@/lib/pm/clients";
import { teamsFromTask } from "@/lib/pm/teams";
import { teamBarBackground } from "@/lib/pm/taskVisualState";
import type { PmProject, PmTask } from "@/types/pm";
import { PriorityFlag } from "@/components/pm/PriorityFlag";

interface Props {
  task: PmTask;
  project?: PmProject;
  phaseName?: string | null;
  clientName?: string | null;
  showProjectHeader?: boolean;
  onOpen: (id: string) => void;
  onChanged?: () => void;
}


function isOverdue(t: PmTask) {
  if (!t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString())
    && t.status !== "complete" && t.status !== "approved";
}

/** Richer card for project-type tasks. Shows project hierarchy + phase context. */
export function ProjectTaskCard({
  task, project, phaseName, clientName, showProjectHeader = true, onOpen, onChanged,
}: Props) {
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
  const showTeamBar = !!teamBg && !isCareerSite && !isInternal && !unclaimed;
  return (
    <Card className={cn(
      "relative overflow-hidden card-lift border border-border",
      unclaimed && !isInternal && !isCareerSite && "border-l-4 border-l-amber-500",
      isInternal && !isCareerSite && "internal-border-l",
      isCareerSite && "careersite-border-l",
    )}>
      {showTeamBar && <TeamColorBar background={teamBg} />}
      <CardContent className={cn("p-4 space-y-2", showTeamBar && "pl-5")}>
        {showProjectHeader && project && (
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Link
              to={`/pm/projects/${project.id}`}
              className="flex items-center gap-2 min-w-0 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-bold text-sm truncate">{project.title}</span>
              <WorkTypeBadge workType="project" compact />
              {isInternal && <span className="internal-pill">Internal</span>}
              {isCareerSite && (
                <span className="careersite-pill">Career Site{csLabel ? ` · ${csLabel}` : ""}</span>
              )}
            </Link>
            {phaseName && (
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                {phaseName}
              </Badge>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="w-full text-left flex items-center gap-2"
        >
          <PriorityFlag priority={task.priority} size="xs" />
          {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <span className="text-sm font-medium flex-1 truncate hover:underline">{task.title}</span>
          <StatusPill status={task.status} />
        </button>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            {clientName && <span className="truncate">{clientName}</span>}
            {clientName && task.due_date && <span>·</span>}
            {task.due_date && (
              <span className={cn(overdue && "text-red-500 font-medium")}>
                Due {fmtDate(task.due_date)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unclaimed ? (
              team.length > 0
                ? <AvatarStack userIds={team} max={3} size="xs" muted />
                : <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" muted />
            ) : (
              <AvatarStack userIds={team} max={3} size="xs" highlightId={task.assignee_id} />
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <ClaimButton task={task} onChanged={onChanged} />
            </div>
            {project && (
              <Link
                to={`/pm/projects/${project.id}`}
                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                title="Open project"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

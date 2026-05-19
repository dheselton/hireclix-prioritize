import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/pm/format";
import { StatusPill } from "@/components/pm/StatusPill";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { UserAvatar } from "@/components/pm/UserAvatar";
import type { PmProject, PmTask, TaskPriority } from "@/types/pm";

interface Props {
  task: PmTask;
  project?: PmProject;
  phaseName?: string | null;
  clientName?: string | null;
  showProjectHeader?: boolean;
  onOpen: (id: string) => void;
  onChanged?: () => void;
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-slate-400",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

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
  return (
    <Card className="hover:shadow-md hover:border-foreground/20 transition">
      <CardContent className="p-4 space-y-2">
        {showProjectHeader && project && (
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Link
              to={`/pm/projects/${project.id}`}
              className="flex items-center gap-2 min-w-0 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-bold text-sm truncate">{project.title}</span>
              <WorkTypeBadge workType="project" compact />
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
          <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_DOT[task.priority])} title={`Priority: ${task.priority}`} />
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
            <UserAvatar userId={task.assignee_id} size="xs" />
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

import { Link } from "react-router-dom";
import { Ban, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate } from "@/lib/pm/format";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import type { PmProject, PmTask, WorkType } from "@/types/pm";


interface Props {
  task: PmTask;
  project?: PmProject;
  clientName?: string | null;
  onOpen: (id: string) => void;
}

/** Blocker-forward card showing the blocker text inline. */
export function BlockedTaskCard({ task, project, clientName, onOpen }: Props) {
  const workType: WorkType = (project?.work_type ?? "project") as WorkType;
  const blocker = task.dev_blocker?.trim();
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onOpen(task.id)}
            className="text-left flex items-center gap-2 min-w-0 hover:underline"
          >
            <PriorityFlag priority={task.priority} size="xs" />
            <span className="font-medium text-sm truncate">{task.title}</span>
            <WorkTypeBadge workType={workType} compact />
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <UserAvatar userId={task.assignee_id} size="xs" />
            {project && (
              <Link to={`/pm/projects/${project.id}`} className="text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
          {project && <span className="truncate">{project.title}</span>}
          {clientName && <><span>·</span><span className="truncate">{clientName}</span></>}
          {task.due_date && <><span>·</span><span>Due {fmtDate(task.due_date)}</span></>}
        </div>
        <div className="rounded border border-red-500/30 bg-background/60 p-2 text-xs flex gap-2">
          <Ban className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
          <span className={blocker ? "" : "italic text-muted-foreground"}>
            {blocker || "Marked blocked — no reason provided yet."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

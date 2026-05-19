import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/pm/format";
import { StatusPill } from "@/components/pm/StatusPill";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { UserAvatar } from "@/components/pm/UserAvatar";
import type { PmTask } from "@/types/pm";

interface Props {
  task: PmTask;
  clientName?: string | null;
  onOpen: (id: string) => void;
  onChanged?: () => void;
}

function isOverdue(t: PmTask) {
  if (!t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString())
    && t.status !== "complete" && t.status !== "approved";
}

/** Compact, thin card for request-type tasks. Optimized for speed/throughput. */
export function RequestTaskCard({ task, clientName, onOpen, onChanged }: Props) {
  const overdue = isOverdue(task);
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        "group w-full text-left rounded-md border bg-card hover:border-foreground/30 hover:bg-muted/40 transition px-3 py-2",
        "flex items-center gap-3",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
          <span className="text-sm font-medium truncate">{task.title}</span>
          <WorkTypeBadge workType="request" compact />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground truncate">
          {clientName && <span className="truncate">{clientName}</span>}
          {clientName && task.due_date && <span>·</span>}
          {task.due_date && (
            <span className={cn(overdue && "text-red-500 font-medium")}>
              Due {fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <StatusPill status={task.status} />
      <UserAvatar userId={task.assignee_id} size="xs" />
      <div onClick={(e) => e.stopPropagation()}>
        <ClaimButton task={task} onChanged={onChanged} />
      </div>
    </button>
  );
}

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ArrowUpRight, Calendar as CalIcon } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import { typeBadgeClass, priorityDotClass } from "@/lib/pm/statusGroups";
import type { PmTask } from "@/types/pm";

export function TaskPreviewPanel({ task, onClose, onOpenFull }: {
  task: PmTask; onClose: () => void; onOpenFull: (id: string) => void;
}) {
  const users = useMockUsers();
  const assignee = users.find(u => u.id === task.assignee_id);
  return (
    <aside className="w-[280px] border-l border-border bg-background p-4 space-y-4 sticky top-4 self-start">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
          {task.type}
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <h3 className="text-[15px] font-medium leading-snug">{task.title}</h3>
      {task.description && (
        <p className="text-[13px] text-muted-foreground line-clamp-4">{task.description}</p>
      )}
      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Assignee</dt>
          <dd className="flex items-center gap-1.5">
            <UserAvatar userId={task.assignee_id} size="xs" />
            <span>{assignee?.name ?? "Unassigned"}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Due</dt>
          <dd className="flex items-center gap-1">
            <CalIcon className="h-3 w-3" />{fmtDate(task.due_date) || "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Priority</dt>
          <dd className="flex items-center gap-1.5 capitalize">
            <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} />
            {task.priority}
          </dd>
        </div>
      </dl>
      <Button className="w-full" onClick={() => onOpenFull(task.id)}>
        Open Full Task <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </aside>
  );
}

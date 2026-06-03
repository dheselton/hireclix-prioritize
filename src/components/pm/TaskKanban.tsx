import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { fmtDateShort } from "@/lib/pm/format";
import { updateTask, logActivity } from "@/lib/pm/api";
import { TASK_STATUSES, type PmTask, type PmProject, type TaskStatus } from "@/types/pm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { SubtaskBadge, useSubtaskCounts } from "@/components/pm/SubtaskBadge";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";

const COL_LABELS: Record<TaskStatus, string> = {
  unclaimed: "Unclaimed", claimed: "Claimed", in_progress: "In Progress", blocked: "Blocked",
  in_review: "In Review", approved: "Approved", complete: "Complete",
};

interface Props {
  tasks: PmTask[];
  projects?: Map<string, PmProject>;
  onOpen: (id: string) => void;
  onChanged?: () => void;
  columns?: TaskStatus[];
}

export function TaskKanban({ tasks, projects, onOpen, onChanged, columns = TASK_STATUSES }: Props) {
  const { user } = useCurrentUser();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const subCounts = useSubtaskCounts(tasks.map(t => t.id));

  async function moveTo(taskId: string, status: TaskStatus) {
    const t = tasks.find(x => x.id === taskId);
    if (!t || t.status === status) return;
    await updateTask(taskId, { status });
    await logActivity({
      task_id: taskId, project_id: t.project_id, user_id: user?.id,
      action: "task.status_changed", payload: { from: t.status, to: status },
    });
    toast.success(`Moved to ${COL_LABELS[status]}`);
    onChanged?.();
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map(s => {
        const items = tasks.filter(t => t.status === s);
        return (
          <div
            key={s}
            className="flex-shrink-0 w-72 bg-muted/30 rounded-lg p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (draggingId) { moveTo(draggingId, s); setDraggingId(null); } }}
          >
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide">{COL_LABELS[s]}</div>
              <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {items.map(t => {
                const proj = projects?.get(t.project_id);
                const blocked = t.status === "blocked";
                return (
                  <Card
                    key={t.id}
                    draggable
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition",
                      blocked && "border-red-500/60",
                      t.status === "unclaimed" && "unclaimed-card",
                    )}
                  >
                    <CardContent className="p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <WorkTypeBadge workType={(proj as any)?.work_type} compact />
                        <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                        <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                        <SubtaskBadge count={subCounts.get(t.id)} />
                      </div>
                      <div className="text-sm font-medium leading-tight">{t.title}</div>
                      {proj && <div className="text-[11px] text-muted-foreground">{proj.title}</div>}
                      {blocked && t.dev_blocker && <div className="text-[11px] text-red-600 italic">⚠ {t.dev_blocker}</div>}
                      <div className="flex items-center justify-between pt-1">
                        <UserAvatar userId={t.assignee_id} size="xs" />
                        {t.status === "unclaimed"
                          ? <ClaimButton task={t} onChanged={onChanged} />
                          : <span className="text-[11px] text-muted-foreground">{fmtDateShort(t.due_date)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

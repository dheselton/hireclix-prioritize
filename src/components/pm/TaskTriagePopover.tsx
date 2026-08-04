import { useState } from "react";
import { MoreHorizontal, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusPickerPopover } from "@/components/pm/project/board/StatusPickerPopover";
import { InlineDatePopover } from "@/components/pm/project/board/InlineDatePopover";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { GROUP_PRIMARY_STATUS } from "@/components/pm/project/board/boardStyles";
import { groupForStatus, type StatusGroupId } from "@/lib/pm/statusGroups";
import { updateTask } from "@/lib/pm/api";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { coerceTaskKind } from "@/lib/pm/taskKind";
import { UserAvatar } from "@/components/pm/UserAvatar";
import type { PmTask } from "@/types/pm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Compact triage popover for task LIST rows — change status, due date, or owner
 * without leaving the list. Reuses the same pickers the board cards use.
 */
export function TaskTriagePopover({
  task,
  onChanged,
  className,
  hideClaimed = false,
}: {
  task: PmTask;
  onChanged?: () => void;
  className?: string;
  hideClaimed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const kind = coerceTaskKind((task.custom_fields as any)?.kind);

  async function patch(label: string, p: Partial<PmTask>) {
    try {
      await updateTask(task.id, p);
      toast.success(label);
      emitTasksChanged();
      onChanged?.();
    } catch {
      toast.error(`Couldn't ${label.toLowerCase()}`);
    }
  }

  const pickStatus = (g: StatusGroupId) => {
    const next = GROUP_PRIMARY_STATUS[g];
    if (next === task.status) return;
    patch("Status updated", { status: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Quick actions"
          title="Quick actions"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className={cn(
            "h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition",
            className,
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-60 p-3 space-y-3 bg-popover z-50"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-xs font-medium truncate">{task.title}</div>

        <Row label="Status">
          <StatusPickerPopover
            currentGroup={groupForStatus(task.status).id}
            onPick={pickStatus}
            hideClaimed={hideClaimed}
            kind={kind}
          />
        </Row>

        <Row label="Due">
          <InlineDatePopover
            value={task.due_date}
            onChange={iso => patch("Due date updated", { due_date: iso })}
          />
        </Row>

        <Row label="Owner">
          <AssigneePopover
            taskId={task.id}
            assigneeId={task.assignee_id}
            size="xs"
            onChanged={onChanged}
            trigger={
              <button type="button" className="inline-flex items-center gap-1.5 text-[11px] hover:text-foreground text-muted-foreground transition">
                <UserAvatar userId={task.assignee_id ?? undefined} size="xs" />
                <span>{task.assignee_id ? "Change" : "Assign"}</span>
              </button>
            }
          />
        </Row>

        <a
          href={`/pm/tasks/${task.id}`}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1 border-t border-border"
          onClick={() => setOpen(false)}
        >
          <ExternalLink className="h-3 w-3" /> Open workspace
        </a>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

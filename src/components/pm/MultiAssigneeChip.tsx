import { AvatarStack } from "@/components/pm/AvatarStack";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { useTaskCoAssignees, combineAssignees } from "@/lib/pm/assignees";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  primaryId: string | null | undefined;
  size?: "xs" | "sm";
  /** Show with reduced opacity (e.g. unclaimed). */
  muted?: boolean;
  className?: string;
  onChanged?: () => void;
}

/**
 * Renders all assignees on a task (primary highlighted) and opens the multi
 * picker on click. Falls back to a single avatar button when there's only one.
 */
export function MultiAssigneeChip({
  taskId, primaryId, size = "xs", muted, className, onChanged,
}: Props) {
  const co = useTaskCoAssignees(taskId);
  const all = combineAssignees(primaryId ?? null, co);

  const trigger = all.length <= 1
    ? <UserAvatar userId={primaryId ?? null} size={size} />
    : (
      <div className={cn("inline-flex", muted && "opacity-60")}>
        <AvatarStack userIds={all} max={3} size={size} highlightId={primaryId ?? null} />
      </div>
    );

  return (
    <AssigneePopover
      taskId={taskId}
      assigneeId={primaryId ?? null}
      size={size}
      mode="multi"
      onChanged={onChanged}
      trigger={<span className={cn("inline-flex", className)}>{trigger}</span>}
    />
  );
}

import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { updateTask, logActivity } from "@/lib/pm/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PmTask } from "@/types/pm";

interface Props {
  task: Pick<PmTask, "id" | "project_id" | "status" | "title">;
  onChanged?: () => void;
  size?: "sm" | "xs";
  className?: string;
}

/** One-click "Claim" — assigns the task to the current user and flips status to claimed. */
export function ClaimButton({ task, onChanged, size = "xs", className }: Props) {
  const { user } = useCurrentUser();

  if (task.status !== "unclaimed") return null;

  async function handleClaim(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) { toast.error("No active user"); return; }
    await updateTask(task.id, { assignee_id: user.id, status: "claimed" });
    await logActivity({
      task_id: task.id, project_id: task.project_id, user_id: user.id,
      action: "task.claimed", payload: { title: task.title },
    });
    toast.success(`Claimed: ${task.title}`);
    onChanged?.();
  }

  return (
    <Button
      onClick={handleClaim}
      size="sm"
      className={cn(
        "h-6 gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold px-2 shadow",
        size === "sm" && "h-7 text-xs",
        className,
      )}
    >
      <Hand className="h-3 w-3" />
      Claim
    </Button>
  );
}

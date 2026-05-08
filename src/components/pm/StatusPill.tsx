import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, type TaskStatus } from "@/types/pm";

const LABELS: Record<TaskStatus, string> = {
  unclaimed: "Unclaimed", claimed: "Claimed", in_progress: "In Progress",
  blocked: "Blocked", in_review: "In Review", approved: "Approved", complete: "Complete",
};

export function StatusPill({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent text-xs font-medium", STATUS_COLORS[status], className)}>
      {LABELS[status]}
    </Badge>
  );
}

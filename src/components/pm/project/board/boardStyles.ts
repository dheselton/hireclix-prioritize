import type { StatusGroupId } from "@/lib/pm/statusGroups";
import type { TaskStatus } from "@/types/pm";

export const STATUS_PILL_CLASS: Record<StatusGroupId, string> = {
  ready: "bg-muted text-muted-foreground",
  in_progress: "bg-info/15 text-info",
  in_review: "bg-warning/15 text-warning",
  complete: "bg-success/15 text-success",
};

export const STATUS_DOT_CLASS: Record<StatusGroupId, string> = {
  ready: "bg-muted-foreground",
  in_progress: "bg-info",
  in_review: "bg-warning",
  complete: "bg-success",
};

export const GROUP_PRIMARY_STATUS: Record<StatusGroupId, TaskStatus> = {
  ready: "unclaimed",
  in_progress: "in_progress",
  in_review: "in_review",
  complete: "complete",
};

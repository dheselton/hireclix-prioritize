import { TERMINAL_STATUSES, type TaskStatus, type TaskType, type TaskPriority } from "@/types/pm";

export type StatusGroupId = "ready" | "claimed" | "in_progress" | "in_review" | "complete";

export interface StatusGroupDef {
  id: StatusGroupId;
  label: string;
  /** Tailwind text color token */
  text: string;
  /** Tailwind bg color token */
  bg: string;
  /** Tailwind border color token */
  border: string;
  statuses: TaskStatus[];
}

export const STATUS_GROUPS: StatusGroupDef[] = [
  { id: "ready", label: "Ready", text: "text-muted-foreground", bg: "bg-muted-foreground", border: "border-muted-foreground", statuses: ["unclaimed"] },
  { id: "claimed", label: "Claimed", text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500", border: "border-sky-500", statuses: ["claimed"] },
  { id: "in_progress", label: "In Progress", text: "text-info", bg: "bg-info", border: "border-info", statuses: ["in_progress", "blocked"] },
  { id: "in_review", label: "In Review", text: "text-warning", bg: "bg-warning", border: "border-warning", statuses: ["in_review"] },
  { id: "complete", label: "Complete", text: "text-success", bg: "bg-success", border: "border-success", statuses: TERMINAL_STATUSES },
];

export function groupForStatus(s: TaskStatus): StatusGroupDef {
  return STATUS_GROUPS.find(g => g.statuses.includes(s)) ?? STATUS_GROUPS[0];
}

const TYPE_STYLE: Record<string, string> = {
  design: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  content: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  dev: "bg-info/15 text-info",
  qa: "bg-success/15 text-success",
  review: "bg-muted text-muted-foreground",
  approval: "bg-muted text-muted-foreground",
  strategy: "bg-muted text-muted-foreground",
  research: "bg-muted text-muted-foreground",
  analytics: "bg-muted text-muted-foreground",
  reporting: "bg-muted text-muted-foreground",
};
export function typeBadgeClass(t: TaskType): string {
  return TYPE_STYLE[t] ?? "bg-muted text-muted-foreground";
}

export function priorityDotClass(p: TaskPriority): string {
  if (p === "urgent" || p === "high") return "bg-destructive";
  if (p === "medium") return "bg-warning";
  return "bg-muted-foreground/50";
}

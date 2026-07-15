// Task kind classifier — lets a "task" row also represent a Decision
// (e.g. "Use www vs apex for cname") or an Issue/Risk (e.g. "Client
// mentioned possible rebrand"). Stored on pm_tasks.custom_fields.kind so
// no schema change is required. Renders alongside normal tasks so the
// whole team can see RAID items on the same board.
import { CheckSquare, GitBranch, AlertTriangle, type LucideIcon } from "lucide-react";

export type TaskKind = "task" | "decision" | "issue";

export const TASK_KINDS: TaskKind[] = ["task", "decision", "issue"];

export interface KindMeta {
  id: TaskKind;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Tailwind classes for the small badge chip. */
  badgeClass: string;
  /** Solid dot color for compact renderings. */
  dotHsl: string;
  description: string;
}

export const KIND_META: Record<TaskKind, KindMeta> = {
  task: {
    id: "task",
    label: "Task",
    short: "Task",
    icon: CheckSquare,
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotHsl: "hsl(220 10% 55%)",
    description: "Something that needs to get done.",
  },
  decision: {
    id: "decision",
    label: "Decision",
    short: "Decision",
    icon: GitBranch,
    badgeClass:
      "bg-[hsl(220_90%_60%/0.12)] text-[hsl(220_90%_55%)] border-[hsl(220_90%_60%/0.4)]",
    dotHsl: "hsl(220 90% 60%)",
    description: "A call the team needs to make (e.g. CNAME choice).",
  },
  issue: {
    id: "issue",
    label: "Issue / Risk",
    short: "Risk",
    icon: AlertTriangle,
    badgeClass:
      "bg-[hsl(28_90%_55%/0.12)] text-[hsl(28_90%_45%)] border-[hsl(28_90%_55%/0.4)]",
    dotHsl: "hsl(28 90% 55%)",
    description: "A risk or blocker to log and watch (e.g. possible rebrand).",
  },
};

export function getTaskKind(task: unknown): TaskKind {
  const cf = (task as any)?.custom_fields;
  const raw = cf?.kind;
  return raw === "decision" || raw === "issue" ? raw : "task";
}

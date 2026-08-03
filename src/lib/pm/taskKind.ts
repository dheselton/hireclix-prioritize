// Task kind classifier — lets a "task" row also represent a Decision
// (e.g. "Use www vs apex for cname") or an Issue/Risk (e.g. "Client
// mentioned possible rebrand"). Stored on pm_tasks.custom_fields.kind so
// no schema change is required. Renders alongside normal tasks so the
// whole team can see RAID items on the same board.
import { CheckSquare, GitBranch, AlertTriangle, Bug, type LucideIcon } from "lucide-react";
import type { PmTask, TaskStatus } from "@/types/pm";
import type { StatusGroupId } from "@/lib/pm/statusGroups";

/** Canonical list of accepted values for custom_fields.kind. */
export const VALID_TASK_KINDS = ["task", "decision", "issue", "qa"] as const;

export type TaskKind = (typeof VALID_TASK_KINDS)[number];

/** Back-compat alias — same values, mutable array shape. */
export const TASK_KINDS: TaskKind[] = [...VALID_TASK_KINDS];

export function isValidTaskKind(v: unknown): v is TaskKind {
  return typeof v === "string" && (VALID_TASK_KINDS as readonly string[]).includes(v);
}

/** Throws when the value isn't a known kind — use before persisting. */
export function assertTaskKind(v: unknown): TaskKind {
  if (!isValidTaskKind(v)) {
    throw new Error(
      `Invalid task kind "${String(v)}". Expected one of: ${VALID_TASK_KINDS.join(", ")}.`,
    );
  }
  return v;
}

const warnedKinds = new Set<string>();

/** Read path: unknown values fall back to "task" and warn once per value. */
export function coerceTaskKind(v: unknown): TaskKind {
  if (v == null || v === "") return "task";
  if (isValidTaskKind(v)) return v;
  const key = String(v);
  if (!warnedKinds.has(key)) {
    warnedKinds.add(key);
    console.warn(
      `[taskKind] Unrecognized custom_fields.kind "${key}" — falling back to "task" labels.`,
    );
  }
  return "task";
}


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
  qa: {
    id: "qa",
    label: "QA Ticket",
    short: "QA",
    icon: Bug,
    badgeClass:
      "bg-[hsl(345_80%_55%/0.12)] text-[hsl(345_80%_45%)] border-[hsl(345_80%_55%/0.4)]",
    dotHsl: "hsl(345 80% 55%)",
    description: "A bug or issue reported during QA / go-live testing.",
  },
};

export function getTaskKind(task: unknown): TaskKind {
  const cf = (task as any)?.custom_fields;
  return coerceTaskKind(cf?.kind);
}

// ---- Kind-aware status vocabulary ---------------------------------------
// The underlying pm_tasks.status enum is unchanged — scheduler, filters,
// and existing status groups keep working. These maps only relabel how a
// row is spoken about in the UI when its kind is Decision or Risk.

const DECISION_STATUS_LABEL: Record<TaskStatus, string> = {
  unclaimed: "Pending",
  claimed: "Pending",
  in_progress: "Being decided",
  blocked: "Blocked",
  in_review: "Under review",
  complete: "Decided",
  approved: "Decided",
};

const RISK_STATUS_LABEL: Record<TaskStatus, string> = {
  unclaimed: "Open",
  claimed: "Owned",
  in_progress: "Monitoring",
  blocked: "Blocked",
  in_review: "Reviewing",
  complete: "Mitigated",
  approved: "Closed",
};

const QA_STATUS_LABEL: Record<TaskStatus, string> = {
  unclaimed: "New",
  claimed: "Triaging",
  in_progress: "In Fix",
  blocked: "Blocked",
  in_review: "Ready to Verify",
  complete: "Verified",
  approved: "Closed",
};

const DECISION_GROUP_LABEL: Partial<Record<StatusGroupId, string>> = {
  ready: "Pending",
  claimed: "Pending",
  in_progress: "Deciding",
  in_review: "Review",
  complete: "Decided",
};

const RISK_GROUP_LABEL: Partial<Record<StatusGroupId, string>> = {
  ready: "Open",
  claimed: "Owned",
  in_progress: "Monitoring",
  in_review: "Reviewing",
  complete: "Mitigated",
};

const QA_GROUP_LABEL: Partial<Record<StatusGroupId, string>> = {
  ready: "New",
  claimed: "Triaging",
  in_progress: "In Fix",
  in_review: "Ready to Verify",
  complete: "Verified",
};

export function getKindStatusLabel(status: TaskStatus, kind: TaskKind): string {
  if (kind === "decision") return DECISION_STATUS_LABEL[status];
  if (kind === "issue") return RISK_STATUS_LABEL[status];
  if (kind === "qa") return QA_STATUS_LABEL[status];
  return "";
}

export function getKindGroupLabel(gid: StatusGroupId, kind: TaskKind): string | null {
  if (kind === "decision") return DECISION_GROUP_LABEL[gid] ?? null;
  if (kind === "issue") return RISK_GROUP_LABEL[gid] ?? null;
  if (kind === "qa") return QA_GROUP_LABEL[gid] ?? null;
  return null;
}

// A RAID item is "open" (needs attention) when it isn't Decided / Mitigated / Closed.
export function isRaidOpen(t: PmTask): boolean {
  return t.status !== "complete" && t.status !== "approved";
}

/** Days since a task was created (used to flag stale decisions). */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

// ---- Risk-specific metadata (stored on custom_fields.raid) --------------

export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type Likelihood = "low" | "medium" | "high";

export const RISK_SEVERITIES: RiskSeverity[] = ["low", "medium", "high", "critical"];
export const LIKELIHOODS: Likelihood[] = ["low", "medium", "high"];

export interface RaidDetails {
  severity?: RiskSeverity;
  likelihood?: Likelihood;
  mitigation?: string;
  impact?: string;
  decision_needed_by?: string | null;
  options?: string[];
  decision_made?: string;
}

export function getRaidDetails(task: unknown): RaidDetails {
  const cf = (task as any)?.custom_fields;
  const raid = cf?.raid;
  return (raid && typeof raid === "object" ? raid : {}) as RaidDetails;
}

export function isHighSeverityRisk(task: PmTask): boolean {
  if (getTaskKind(task) !== "issue") return false;
  if (!isRaidOpen(task)) return false;
  const sev = getRaidDetails(task).severity;
  return sev === "high" || sev === "critical";
}

export function isStaleDecision(task: PmTask, staleDays = 3): boolean {
  if (getTaskKind(task) !== "decision") return false;
  if (!isRaidOpen(task)) return false;
  return daysSince(task.created_at as any) >= staleDays;
}

export const SEVERITY_STYLE: Record<RiskSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

// ---- QA-specific metadata (stored on custom_fields.qa) ------------------

export type QaSeverity = "blocker" | "major" | "minor" | "cosmetic";
export type QaReproducibility = "always" | "sometimes" | "once" | "unknown";
export type QaResolution = "fixed" | "wont_fix" | "duplicate" | "cannot_reproduce";

export const QA_SEVERITIES: QaSeverity[] = ["blocker", "major", "minor", "cosmetic"];

export const QA_SEVERITY_STYLE: Record<QaSeverity, string> = {
  blocker: "bg-destructive/15 text-destructive border-destructive/30",
  major: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  minor: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  cosmetic: "bg-muted text-muted-foreground border-border",
};

export interface QaDetails {
  severity?: QaSeverity;
  reproducibility?: QaReproducibility;
  environment?: string;      // URL / browser / device
  reported_by_name?: string; // external tester name
  steps?: string;
  expected?: string;
  actual?: string;
  resolution?: QaResolution;
  duplicate_of?: string;     // task id
}

export function getQaDetails(task: unknown): QaDetails {
  const cf = (task as any)?.custom_fields;
  const qa = cf?.qa;
  return (qa && typeof qa === "object" ? qa : {}) as QaDetails;
}

export function isQaOpen(t: PmTask): boolean {
  return t.status !== "complete" && t.status !== "approved";
}

export function isBlockerQa(task: PmTask): boolean {
  if (getTaskKind(task) !== "qa") return false;
  if (!isQaOpen(task)) return false;
  return getQaDetails(task).severity === "blocker";
}


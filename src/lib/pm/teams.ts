import type { PmRole, TaskType } from "@/types/pm";

export type Team =
  | "design"
  | "dev"
  | "pm"
  | "qa"
  | "strategy"
  | "analytics"
  | "csm"
  | "support";

export const ALL_TEAMS: Team[] = [
  "design", "dev", "pm", "qa", "strategy", "analytics", "csm", "support",
];

export const TEAM_LABEL: Record<Team, string> = {
  design: "Design",
  dev: "Dev",
  pm: "PM",
  qa: "QA",
  strategy: "Strategy",
  analytics: "Analytics",
  csm: "CSM",
  support: "Help / Support",
};

export const TEAM_COLOR: Record<Team, string> = {
  design: "hsl(280 70% 60%)",
  dev: "hsl(150 60% 45%)",
  pm: "hsl(220 70% 55%)",
  qa: "hsl(50 90% 50%)",
  strategy: "hsl(260 70% 60%)",
  analytics: "hsl(190 70% 45%)",
  csm: "hsl(330 65% 55%)",
  support: "hsl(15 80% 55%)",
};

/** Map a login role → its primary team (used to seed the per-user default filter). */
export const ROLE_TO_TEAM: Record<PmRole, Team | null> = {
  pm: "pm",
  designer: "design",
  developer: "dev",
  qa: "qa",
  strategist: "strategy",
  analyst: "analytics",
  csm: "csm",
  support: "support",
  submitter: null,
};

/**
 * Peer teams that share a "My team" view. Designers + developers work as one
 * combined production team and need to see each other's tasks by default.
 * Every other team is solo.
 */
export const TEAM_PEERS: Record<Team, Team[]> = {
  design: ["design", "dev"],
  dev: ["design", "dev"],
  pm: ["pm"],
  qa: ["qa"],
  strategy: ["strategy"],
  analytics: ["analytics"],
  csm: ["csm"],
  support: ["support"],
};

/** Human label for the peer-set chip. */
export const TEAM_PEER_LABEL: Partial<Record<Team, string>> = {
  design: "Creative + Dev",
  dev: "Creative + Dev",
};

/** Default team set per task type (matches the DB trigger). */
export const DEFAULT_TEAMS_FOR_TYPE: Record<TaskType, Team[]> = {
  design: ["design"],
  content: ["design"],
  dev: ["dev"],
  qa: ["qa"],
  review: ["pm"],
  approval: ["pm"],
  strategy: ["strategy"],
  research: ["strategy"],
  analytics: ["analytics"],
  reporting: ["analytics"],
};

/** Safe coercion: pull a Team[] off any record-like value. */
export function teamsFromTask(t: { teams?: unknown }): Team[] {
  const raw = (t as { teams?: unknown }).teams;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is Team => typeof x === "string" && (ALL_TEAMS as string[]).includes(x));
}

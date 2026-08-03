import type { MockUser, PmTask, Track, Team, TaskType, PmRole } from "@/types/pm";
import { ROLE_TO_TEAM, TEAM_COLOR } from "@/lib/pm/teams";

/** Canonical labels live in lib/pm/teams.ts — re-exported for existing imports. */
export { TEAM_LABEL } from "@/lib/pm/teams";

/** A user's primary track. */
export function userTrack(user: Pick<MockUser, "role"> | null | undefined): Track {
  if (!user) return "production";
  if (user.role === "pm") return "pm";
  if (user.role === "strategist") return "strategy";
  if (user.role === "analyst") return "analytics";
  return "production";
}

/** True if user can perform production work (designer or developer, primary or secondary). */
export function isProductionUser(user: Pick<MockUser, "role" | "secondary_role"> | null | undefined): boolean {
  if (!user) return false;
  const roles = [user.role, user.secondary_role].filter(Boolean) as string[];
  return roles.some(r => r === "designer" || r === "developer");
}

/** Map a task type to its team (mirrors DEFAULT_TEAMS_FOR_TYPE in teams.ts). */
export function teamForType(type: TaskType): Team {
  switch (type) {
    case "design":
    case "content":
      return "design";
    case "dev":
      return "dev";
    case "qa":
      return "qa";
    case "strategy":
    case "research":
      return "strategy";
    case "analytics":
    case "reporting":
      return "analytics";
    case "review":
    case "approval":
    default:
      return "pm";
  }
}

/** Map a task to its team using track first, then falling back to type. */
export function teamForTask(t: Pick<PmTask, "track" | "type">): Team {
  if (t.track === "strategy") return "strategy";
  if (t.track === "analytics") return "analytics";
  if (t.track === "pm") return "pm";
  // "production" spans design + dev — resolve by task type.
  return teamForType(t.type);
}

/** Default team a role belongs to. Roles without a team fall back to PM. */
export function teamForRole(role: PmRole | null | undefined): Team {
  if (!role) return "pm";
  return ROLE_TO_TEAM[role] ?? "pm";
}

/** Tints used by the unclaimed banner / sidebar badge to match the team. */
export const TEAM_ACCENT: Record<Team, string> = {
  design: "hsl(var(--primary))",
  dev: "hsl(var(--primary))",
  pm: "hsl(200 80% 50%)",
  strategy: "hsl(260 70% 60%)",
  analytics: "hsl(190 70% 45%)",
  qa: TEAM_COLOR.qa,
  csm: TEAM_COLOR.csm,
  support: TEAM_COLOR.support,
};


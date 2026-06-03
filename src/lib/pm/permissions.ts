/**
 * Central role-based visibility rules for the PM app.
 *
 * Single source of truth consumed by the sidebar, the route guard, and any
 * page that needs to render conditionally per role.
 *
 * When real auth is wired up later, `useCurrentUser()` already abstracts the
 * source of the active user (see `getAuthUserId` in `mockUser.ts`), so these
 * helpers do not need to change.
 */

import type { PmRole } from "@/types/pm";

/** Logical surfaces in the app. Used by the sidebar + route guard. */
export type Surface =
  | "queue"        // /pm
  | "work"         // /pm/work (+ legacy redirects)
  | "workload"    // /pm/workload
  | "timeline"    // /pm/timeline
  | "time"        // /pm/time
  | "forms"       // /pm/forms (list)
  | "formBuilder" // /pm/forms/:id/edit
  | "templates"   // /pm/templates (+ builder)
  | "integrations"// /pm/integrations
  | "snippets"    // /snippets
  | "help"        // /pm/help
  | "projectDetail" // /pm/projects/:id
  | "taskWorkspace"; // /pm/tasks/:id

/** True if a role can see a given top-level surface. */
export function canSee(role: PmRole | null | undefined, surface: Surface): boolean {
  const r: PmRole = role ?? "pm";

  if (r === "submitter") {
    // Submitters: only the Briefing (My Requests view), Work shell, and Forms list to submit.
    return surface === "queue" || surface === "work" || surface === "forms" || surface === "help" || surface === "taskWorkspace" || surface === "projectDetail";
  }

  if (r === "pm") return true; // PMs see everything.

  // Designer / developer / strategist / analyst.
  switch (surface) {
    case "templates":
    case "formBuilder":
    case "integrations":
      return false;
    case "snippets":
      return r === "developer" || r === "designer";
    default:
      return true;
  }
}

/** Convenience: route prefixes blocked for a role. Drives the route guard. */
export function blockedRoutePrefixes(role: PmRole | null | undefined): string[] {
  const out: string[] = [];
  if (!canSee(role, "templates")) out.push("/pm/templates");
  if (!canSee(role, "formBuilder")) out.push("/pm/forms/"); // builder routes only — list lives at /pm/forms
  if (!canSee(role, "integrations")) out.push("/pm/integrations");
  if (!canSee(role, "workload")) out.push("/pm/workload");
  if (!canSee(role, "timeline")) out.push("/pm/timeline");
  if (!canSee(role, "time")) out.push("/pm/time");
  if (!canSee(role, "snippets")) out.push("/snippets");
  if (!canSee(role, "work")) out.push("/pm/work");
  return out;
}

/** Where a role should be redirected when they hit a blocked route. */
export function fallbackPath(role: PmRole | null | undefined): string {
  return canSee(role, "work") && role !== "submitter" ? "/pm/work" : "/pm";
}

/** Daily Briefing data scope per role. */
export type BriefingScope = "team" | "personal" | "submitter";
export function briefingScope(role: PmRole | null | undefined): BriefingScope {
  if (role === "submitter") return "submitter";
  if (role === "pm") return "team";
  return "personal";
}

/** Timesheet visibility per role. */
export type TimesheetScope = "team-toggle" | "self" | "hidden";
export function timesheetScope(role: PmRole | null | undefined): TimesheetScope {
  if (role === "submitter") return "hidden";
  if (role === "pm") return "team-toggle";
  return "self";
}

/** True when a non-PM staff member should see a project (they're a member OR a PM). */
export function canSeeProject(
  role: PmRole | null | undefined,
  userId: string | null | undefined,
  memberIds: Set<string> | string[],
): boolean {
  if (role === "pm") return true;
  if (role === "submitter") return false; // submitters reach projects only via their own request links
  if (!userId) return false;
  const set = memberIds instanceof Set ? memberIds : new Set(memberIds);
  return set.has(userId);
}

/** True when a user should see a task (assignee, co-assignee, project member, PM, or unclaimed-in-track). */
export function canSeeTask(
  role: PmRole | null | undefined,
  userId: string | null | undefined,
  task: { assignee_id?: string | null; status?: string | null; created_by?: string | null },
  projectMemberIds: Set<string> | string[],
  coAssigneeIds: Set<string> | string[] = [],
): boolean {
  if (role === "pm") return true;
  if (!userId) return false;
  if (task.assignee_id === userId) return true;
  if (task.created_by === userId) return true;
  const co = coAssigneeIds instanceof Set ? coAssigneeIds : new Set(coAssigneeIds);
  if (co.has(userId)) return true;
  const members = projectMemberIds instanceof Set ? projectMemberIds : new Set(projectMemberIds);
  if (members.has(userId)) return true;
  // Unclaimed tasks remain visible so staff can claim them (briefing rule).
  if (task.status === "unclaimed" && role !== "submitter") return true;
  return false;
}

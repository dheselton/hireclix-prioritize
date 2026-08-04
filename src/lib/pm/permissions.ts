/**
 * Central role-based visibility rules for the PM app.
 *
 * Users can hold multiple roles at once (e.g. PM + Designer + Developer).
 * Every helper accepts either a single role or a list; access is the UNION
 * across all roles the user holds.
 */

import type { PmRole } from "@/types/pm";

export type RoleOrRoles = PmRole | PmRole[] | null | undefined;

/** Normalize any role input to a non-empty list. Defaults to ["pm"]. */
export function toRoles(input: RoleOrRoles): PmRole[] {
  if (!input) return ["pm"];
  if (Array.isArray(input)) return input.length ? input : ["pm"];
  return [input];
}

/** Logical surfaces in the app. Used by the sidebar + route guard. */
export type Surface =
  | "queue"
  | "inbox"
  | "report"
  | "work"
  | "workload"
  | "timeline"
  | "time"
  | "forms"
  | "formBuilder"
  | "templates"
  | "integrations"
  | "snippets"
  | "help"
  | "projectDetail"
  | "taskWorkspace";

function canSeeSingle(r: PmRole, surface: Surface): boolean {
  if (r === "submitter") {
    return surface === "queue" || surface === "work" || surface === "forms" || surface === "help" || surface === "taskWorkspace" || surface === "projectDetail";
  }
  // BA gets the same surface access as PM.
  if (r === "pm" || r === "ba") return true;
  // Tech Lead = union of dev + PM-ish (sees everything except integrations/form builder/templates authoring surfaces treated below).
  if (r === "tech_lead") {
    switch (surface) {
      case "inbox":
      case "report":
      case "templates":
      case "formBuilder":
      case "integrations":
        return false;
      default:
        return true;
    }
  }
  switch (surface) {
    case "inbox":
    case "report":
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

/** True if ANY of the user's roles allows the surface. */
export function canSee(role: RoleOrRoles, surface: Surface): boolean {
  return toRoles(role).some(r => canSeeSingle(r, surface));
}

/** Route prefixes blocked for the given role(s). */
export function blockedRoutePrefixes(role: RoleOrRoles): string[] {
  const out: string[] = [];
  if (!canSee(role, "inbox")) out.push("/pm/inbox");
  if (!canSee(role, "templates")) out.push("/pm/templates");
  if (!canSee(role, "formBuilder")) out.push("/pm/forms/");
  if (!canSee(role, "integrations")) out.push("/pm/integrations");
  if (!canSee(role, "workload")) out.push("/pm/workload");
  if (!canSee(role, "timeline")) out.push("/pm/timeline");
  if (!canSee(role, "time")) out.push("/pm/time");
  if (!canSee(role, "snippets")) out.push("/snippets");
  if (!canSee(role, "work")) out.push("/pm/work");
  return out;
}

/** Where the user should be redirected when they hit a blocked route. */
export function fallbackPath(role: RoleOrRoles): string {
  const roles = toRoles(role);
  const isSubmitterOnly = roles.every(r => r === "submitter");
  return canSee(role, "work") && !isSubmitterOnly ? "/pm/work" : "/pm";
}

/** Daily Briefing data scope. PM in the role set wins. */
export type BriefingScope = "team" | "personal" | "submitter";
export function briefingScope(role: RoleOrRoles): BriefingScope {
  const roles = toRoles(role);
  if (roles.some(r => r === "pm" || r === "ba")) return "team";
  if (roles.every(r => r === "submitter")) return "submitter";
  return "personal";
}

/** Timesheet visibility. */
export type TimesheetScope = "team-toggle" | "self" | "hidden";
export function timesheetScope(role: RoleOrRoles): TimesheetScope {
  const roles = toRoles(role);
  if (roles.some(r => r === "pm" || r === "ba")) return "team-toggle";
  if (roles.every(r => r === "submitter")) return "hidden";
  return "self";
}

/** True when a non-PM staff member should see a project. */
export function canSeeProject(
  role: RoleOrRoles,
  userId: string | null | undefined,
  memberIds: Set<string> | string[],
): boolean {
  const roles = toRoles(role);
  if (roles.some(r => r === "pm" || r === "ba")) return true;
  if (roles.every(r => r === "submitter")) return false;
  if (!userId) return false;
  const set = memberIds instanceof Set ? memberIds : new Set(memberIds);
  return set.has(userId);
}

/** True when a user should see a task. */
export function canSeeTask(
  role: RoleOrRoles,
  userId: string | null | undefined,
  task: { assignee_id?: string | null; status?: string | null; created_by?: string | null },
  projectMemberIds: Set<string> | string[],
  coAssigneeIds: Set<string> | string[] = [],
): boolean {
  const roles = toRoles(role);
  if (roles.some(r => r === "pm" || r === "ba")) return true;
  if (!userId) return false;
  if (task.assignee_id === userId) return true;
  if (task.created_by === userId) return true;
  const co = coAssigneeIds instanceof Set ? coAssigneeIds : new Set(coAssigneeIds);
  if (co.has(userId)) return true;
  const members = projectMemberIds instanceof Set ? projectMemberIds : new Set(projectMemberIds);
  if (members.has(userId)) return true;
  if (task.status === "unclaimed" && !roles.every(r => r === "submitter")) return true;
  return false;
}

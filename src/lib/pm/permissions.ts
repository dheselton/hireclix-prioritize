/**
 * Central role-based visibility rules for the PM app.
 *
 * Users can hold multiple job roles at once (e.g. PM + Designer + Developer).
 * Every helper accepts either a single role or a list; access is the UNION
 * across all roles the user holds.
 *
 * Admin is an overlay flag (not a job): when true, every surface is visible
 * and operator-scope helpers treat the user like PM/BA.
 */

import type { PmRole } from "@/types/pm";

export type RoleOrRoles = PmRole | PmRole[] | null | undefined;

/** Optional admin overlay for permission helpers. */
export type AccessOpts = { isAdmin?: boolean };

/** Normalize any role input to a list. Empty when missing — deny by default. */
export function toRoles(input: RoleOrRoles): PmRole[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return [input];
}

/** True when the user only holds submitter (no staff job). */
export function isSubmitterOnly(role: RoleOrRoles): boolean {
  const roles = toRoles(role);
  return roles.length > 0 && roles.every((r) => r === "submitter");
}

/** PM/BA job or admin overlay — roster, team timesheets, operator UI. */
export function isOperator(role: RoleOrRoles, opts?: AccessOpts): boolean {
  if (opts?.isAdmin) return true;
  return toRoles(role).some((r) => r === "pm" || r === "ba");
}

/** Approved staff contributors can create both projects and Quick Requests. */
export function canCreateWork(role: RoleOrRoles, opts?: AccessOpts): boolean {
  if (opts?.isAdmin) return true;
  const roles = toRoles(role);
  return roles.length > 0 && !roles.every((r) => r === "submitter");
}

/** Project-level dates, milestones, assignments, and closure are manager actions. */
export function canManageClientWork(role: RoleOrRoles, opts?: AccessOpts): boolean {
  return isOperator(role, opts);
}

/** Logical surfaces in the app. Used by the sidebar + route guard. */
export type Surface =
  | "myWork"
  | "queue"
  | "inbox"
  | "report"
  | "clients"
  | "work"
  | "workload"
  | "timeline"
  | "time"
  | "forms"
  | "formBuilder"
  | "templates"
  | "integrations"
  | "vendors"
  | "team"
  | "roadmap"
  | "snippets"
  | "loomLibrary"
  | "help"
  | "projectDetail"
  | "taskWorkspace"
  | "settings"
  | "profile"
  | "notifications";

/** Creative production roles that can see the external Loom Library resource. */
const LOOM_LIBRARY_ROLES = new Set<PmRole>(["designer", "developer", "tech_lead"]);

function canSeeSingle(r: PmRole, surface: Surface): boolean {
  // Everyone has a personal "My Work" portal and can edit their own settings.
  if (surface === "myWork" || surface === "settings" || surface === "profile" || surface === "notifications") return true;
  // Every approved internal user can discover shared client work.
  if (surface === "clients" || surface === "work") return true;
  if (r === "submitter") {
    return surface === "queue" || surface === "forms" || surface === "help" || surface === "taskWorkspace" || surface === "projectDetail";
  }
  // Loom Library is creative-production only — even PM/BA need a production role
  // (unless admin overlay, handled in canSee).
  if (surface === "loomLibrary") return LOOM_LIBRARY_ROLES.has(r);
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
      case "team":
      case "roadmap":
        return false;
      default:
        return true;
    }
  }
  // Developers can see vendor escalations (often the ones chasing Webflow/iPaaS).
  if (r === "developer" && surface === "vendors") return true;
  switch (surface) {
    case "inbox":
    case "report":
    case "templates":
    case "formBuilder":
    case "integrations":
    case "vendors":
    case "team":
    case "roadmap":
      return false;
    case "snippets":
      return r === "developer" || r === "designer";
    default:
      return true;
  }
}

/** True if ANY of the user's roles allows the surface (or admin overlay). */
export function canSee(role: RoleOrRoles, surface: Surface, opts?: AccessOpts): boolean {
  if (opts?.isAdmin) return true;
  return toRoles(role).some((r) => canSeeSingle(r, surface));
}

/** Route prefixes blocked for the given role(s). */
export function blockedRoutePrefixes(role: RoleOrRoles, opts?: AccessOpts): string[] {
  if (opts?.isAdmin) return [];
  const out: string[] = [];
  if (!canSee(role, "inbox", opts)) out.push("/pm/inbox");
  if (!canSee(role, "report", opts)) out.push("/pm/report");
  if (!canSee(role, "clients", opts)) out.push("/pm/clients");
  if (!canSee(role, "templates", opts)) out.push("/pm/templates");
  if (!canSee(role, "formBuilder", opts)) out.push("/pm/forms/");
  if (!canSee(role, "integrations", opts)) out.push("/pm/integrations");
  if (!canSee(role, "vendors", opts)) out.push("/pm/vendors");
  if (!canSee(role, "team", opts)) out.push("/pm/team");
  if (!canSee(role, "roadmap", opts)) out.push("/roadmap");
  if (!canSee(role, "workload", opts)) out.push("/pm/workload");
  if (!canSee(role, "timeline", opts)) out.push("/pm/timeline");
  if (!canSee(role, "time", opts)) out.push("/pm/time");
  if (!canSee(role, "snippets", opts)) out.push("/snippets");
  if (!canSee(role, "work", opts)) out.push("/pm/work");
  return out;
}

/** Where the user should be redirected when they hit a blocked route. */
export function fallbackPath(role: RoleOrRoles, opts?: AccessOpts): string {
  if (opts?.isAdmin) return "/";
  if (isSubmitterOnly(role)) return "/pm/my-work";
  return "/";
}

/** Only PM/BA/tech_lead (or admin) may publish comments to the client portal. */
export function canPostClientVisible(role: RoleOrRoles, opts?: AccessOpts): boolean {
  if (opts?.isAdmin) return true;
  return toRoles(role).some((r) => r === "pm" || r === "ba" || r === "tech_lead");
}

/** Daily Briefing data scope. Operator wins. */
export type BriefingScope = "team" | "personal" | "submitter";
export function briefingScope(role: RoleOrRoles, opts?: AccessOpts): BriefingScope {
  if (isOperator(role, opts)) return "team";
  if (isSubmitterOnly(role)) return "submitter";
  return "personal";
}

/** Timesheet visibility. */
export type TimesheetScope = "team-toggle" | "self" | "hidden";
export function timesheetScope(role: RoleOrRoles, opts?: AccessOpts): TimesheetScope {
  if (isOperator(role, opts)) return "team-toggle";
  if (isSubmitterOnly(role)) return "hidden";
  return "self";
}

/** True when a non-operator staff member should see a project. */
export function canSeeProject(
  role: RoleOrRoles,
  userId: string | null | undefined,
  memberIds: Set<string> | string[],
  opts?: AccessOpts,
): boolean {
  if (isOperator(role, opts)) return true;
  if (isSubmitterOnly(role)) return false;
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
  opts?: AccessOpts,
): boolean {
  if (isOperator(role, opts)) return true;
  if (!userId) return false;
  if (task.assignee_id === userId) return true;
  if (task.created_by === userId) return true;
  const co = coAssigneeIds instanceof Set ? coAssigneeIds : new Set(coAssigneeIds);
  if (co.has(userId)) return true;
  const members = projectMemberIds instanceof Set ? projectMemberIds : new Set(projectMemberIds);
  if (members.has(userId)) return true;
  if (task.status === "unclaimed" && !isSubmitterOnly(role)) return true;
  return false;
}

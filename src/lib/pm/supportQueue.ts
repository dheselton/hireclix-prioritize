/**
 * Career-site support queue — shared create + rollup helpers.
 *
 * Canonical shape: a child `pm_projects` row (work_type=request) nested under
 * a live career site via parent_project_id, with one or more unclaimed tasks.
 */
import { supabase } from "@/integrations/supabase/client";
import { createProject } from "@/lib/pm/api";
import { applyClientWatchers } from "@/lib/pm/clientWatchers";
import { fanoutNewRequestNotifications } from "@/lib/pm/newRequestNotify";
import { isHardOverdue } from "@/lib/pm/dueState";
import { todayISO } from "@/lib/pm/format";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { refreshCareerSiteProjects } from "@/lib/pm/clients";
import type { RequestType } from "@/lib/pm/requestTypes";
import type { CreationSource } from "@/lib/pm/attribution";
import { isDone, type PmProject, type PmTask, type TaskStatus } from "@/types/pm";

export type SupportRollupStatus = "needs_triage" | "in_progress" | "waiting" | "closed";

export interface SupportRequestRollup {
  project: PmProject;
  requestType: string | null;
  openTasks: number;
  unclaimedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  nextDue: string | null;
  oldestOpenAt: string | null;
  oldestOpenAgeDays: number | null;
  assigneeIds: string[];
  lastActivityAt: string;
  rollupStatus: SupportRollupStatus;
  priority: string | null;
}

export interface SiteQueueSummary {
  parentProjectId: string;
  openRequestCount: number;
  needsTriage: number;
  inProgress: number;
  waiting: number;
  overdue: number;
  closedLast30d: number;
  oldestOpenAgeDays: number | null;
  nextDue: string | null;
  assigneeIds: string[];
}

export interface CreateCareerSiteSupportRequestInput {
  title: string;
  clientId: string;
  parentProjectId: string | null;
  requestType: RequestType;
  description?: string | null;
  customFields?: Record<string, unknown>;
  requestedBy?: string | null;
  createdBy?: string | null;
  taskTitles?: string[];
  creationSource?: CreationSource;
  creationContext?: Record<string, unknown>;
  /** Ship-by / due date stored on the request project's go_live_date. */
  dueDate?: string | null;
}

export interface CreateCareerSiteSupportRequestResult {
  project: PmProject;
  watcherIds: string[];
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA.slice(0, 10)}T00:00:00`);
  const b = new Date(`${isoB.slice(0, 10)}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function rollupOne(project: PmProject, tasks: PmTask[], today = todayISO()): SupportRequestRollup {
  const requestType =
    typeof (project.custom_fields as { request_type?: string } | null)?.request_type === "string"
      ? (project.custom_fields as { request_type: string }).request_type
      : null;

  const inactive = project.status === "complete" || project.status === "archived";
  const open = tasks.filter((t) => !isDone(t.status as TaskStatus));
  const unclaimed = open.filter((t) => t.status === "unclaimed");
  const blocked = open.filter((t) => t.status === "blocked");
  const overdue = open.filter((t) => isHardOverdue(t, today));

  const dues = open
    .map((t) => t.due_date)
    .filter((d): d is string => !!d)
    .sort();
  const nextDue = dues[0] ?? project.go_live_date ?? null;

  const openCreated = open
    .map((t) => t.created_at)
    .filter(Boolean)
    .sort();
  const oldestOpenAt = openCreated[0] ?? (open.length || !inactive ? project.created_at : null);
  const oldestOpenAgeDays = oldestOpenAt ? daysBetween(oldestOpenAt.slice(0, 10), today) : null;

  const assigneeIds = Array.from(
    new Set(open.map((t) => t.assignee_id).filter((id): id is string => !!id)),
  );

  const taskUpdated = tasks
    .map((t) => t.updated_at)
    .filter(Boolean)
    .sort()
    .reverse();
  const lastActivityAt = taskUpdated[0] ?? project.updated_at ?? project.created_at;

  const priorities = open.map((t) => t.priority).filter(Boolean);
  const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  const priority =
    priorities.sort((a, b) => (priorityRank[b] ?? 0) - (priorityRank[a] ?? 0))[0] ?? null;

  let rollupStatus: SupportRollupStatus;
  if (inactive || (tasks.length > 0 && open.length === 0)) {
    rollupStatus = "closed";
  } else if (project.status === "on_hold" || blocked.length > 0) {
    rollupStatus = "waiting";
  } else if (unclaimed.length > 0 || open.length === 0) {
    // Active shell with no tasks yet, or any unclaimed work → needs triage
    rollupStatus = "needs_triage";
  } else {
    rollupStatus = "in_progress";
  }

  return {
    project,
    requestType,
    openTasks: open.length,
    unclaimedTasks: unclaimed.length,
    overdueTasks: overdue.length,
    blockedTasks: blocked.length,
    nextDue,
    oldestOpenAt,
    oldestOpenAgeDays,
    assigneeIds,
    lastActivityAt,
    rollupStatus,
    priority,
  };
}

async function fetchTasksForProjects(projectIds: string[]): Promise<PmTask[]> {
  if (!projectIds.length) return [];
  const { data, error } = await supabase
    .from("pm_tasks")
    .select("*")
    .in("project_id", projectIds);
  if (error) throw error;
  return (data ?? []) as unknown as PmTask[];
}

/** Linked child request projects under a live site, with task rollups. */
export async function fetchSupportQueueForSite(parentProjectId: string): Promise<SupportRequestRollup[]> {
  const { data, error } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("parent_project_id", parentProjectId)
    .eq("work_type", "request")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const projects = (data ?? []) as unknown as PmProject[];
  const tasks = await fetchTasksForProjects(projects.map((p) => p.id));
  const byProject = new Map<string, PmTask[]>();
  for (const t of tasks) {
    const list = byProject.get(t.project_id) ?? [];
    list.push(t);
    byProject.set(t.project_id, list);
  }
  const today = todayISO();
  return projects.map((p) => rollupOne(p, byProject.get(p.id) ?? [], today));
}

/** Workspace-wide queue summaries keyed by live-site parent id. */
export async function fetchSiteQueueSummaries(parentIds: string[]): Promise<Map<string, SiteQueueSummary>> {
  const map = new Map<string, SiteQueueSummary>();
  for (const id of parentIds) {
    map.set(id, {
      parentProjectId: id,
      openRequestCount: 0,
      needsTriage: 0,
      inProgress: 0,
      waiting: 0,
      overdue: 0,
      closedLast30d: 0,
      oldestOpenAgeDays: null,
      nextDue: null,
      assigneeIds: [],
    });
  }
  if (!parentIds.length) return map;

  const { data, error } = await supabase
    .from("pm_projects")
    .select("*")
    .in("parent_project_id", parentIds)
    .eq("work_type", "request");
  if (error) throw error;
  const projects = (data ?? []) as unknown as PmProject[];
  const tasks = await fetchTasksForProjects(projects.map((p) => p.id));
  const byProject = new Map<string, PmTask[]>();
  for (const t of tasks) {
    const list = byProject.get(t.project_id) ?? [];
    list.push(t);
    byProject.set(t.project_id, list);
  }

  const today = todayISO();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  for (const p of projects) {
    const parentId = p.parent_project_id;
    if (!parentId) continue;
    const summary = map.get(parentId);
    if (!summary) continue;
    const rollup = rollupOne(p, byProject.get(p.id) ?? [], today);

    if (rollup.rollupStatus === "closed") {
      const closedAt = p.updated_at ?? p.created_at;
      if (closedAt && closedAt >= cutoffIso) summary.closedLast30d += 1;
      continue;
    }

    summary.openRequestCount += 1;
    if (rollup.rollupStatus === "needs_triage") summary.needsTriage += 1;
    else if (rollup.rollupStatus === "in_progress") summary.inProgress += 1;
    else if (rollup.rollupStatus === "waiting") summary.waiting += 1;
    if (rollup.overdueTasks > 0) summary.overdue += 1;

    if (rollup.oldestOpenAgeDays != null) {
      summary.oldestOpenAgeDays =
        summary.oldestOpenAgeDays == null
          ? rollup.oldestOpenAgeDays
          : Math.max(summary.oldestOpenAgeDays, rollup.oldestOpenAgeDays);
    }
    if (rollup.nextDue) {
      if (!summary.nextDue || rollup.nextDue < summary.nextDue) summary.nextDue = rollup.nextDue;
    }
    for (const aid of rollup.assigneeIds) {
      if (!summary.assigneeIds.includes(aid)) summary.assigneeIds.push(aid);
    }
  }

  return map;
}

/** Career-site request projects that never got linked to a live site. */
export async function fetchUnlinkedCareerSiteRequests(): Promise<PmProject[]> {
  const { data, error } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("work_type", "request")
    .is("parent_project_id", null)
    .not("status", "in", '("complete","archived")')
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PmProject[]).filter((p) => {
    const t = (p.custom_fields as { request_type?: string } | null)?.request_type;
    return typeof t === "string" && t.startsWith("careersite_");
  });
}

/**
 * Create a career-site support request (child project + unclaimed task(s)).
 * Shared by CreateWorkDialog and LogSupportRequestDialog.
 */
export async function createCareerSiteSupportRequest(
  input: CreateCareerSiteSupportRequestInput,
): Promise<CreateCareerSiteSupportRequestResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  if (!input.clientId) throw new Error("Client is required");

  const today = todayISO();
  const creationSource = input.creationSource ?? "manual";
  const creationContext = {
    request_type: input.requestType,
    ...(input.creationContext ?? {}),
  };

  const project = await createProject({
    title,
    type: "quick_request",
    work_type: "request",
    status: "active",
    client_id: input.clientId,
    parent_project_id: input.parentProjectId,
    description: input.description?.trim() || null,
    start_date: today,
    go_live_date: input.dueDate ?? null,
    created_by: input.createdBy ?? null,
    requested_by: input.requestedBy ?? input.createdBy ?? null,
    custom_fields: { request_type: input.requestType, ...(input.customFields ?? {}) },
    creation_source: creationSource,
    creation_context: creationContext,
  } as Partial<PmProject> & { requested_by?: string | null; creation_source?: CreationSource });

  let titles = (input.taskTitles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 3);
  if (!titles.length) titles = [title];
  const taskDescription = input.description?.trim() || null;

  const { error: taskErr } = await supabase.from("pm_tasks").insert(
    titles.map((taskTitle, i) => ({
      project_id: project.id,
      title: taskTitle,
      type: "design",
      status: "unclaimed",
      priority: "medium",
      duration_days: 1,
      sort_order: i * 10,
      created_by: input.createdBy ?? null,
      assignee_id: null,
      description: taskDescription,
      due_date: input.dueDate ?? null,
      creation_source: creationSource,
      creation_context: creationContext,
    })) as never,
  );
  if (taskErr) throw taskErr;

  if (input.requestType.startsWith("careersite_")) {
    refreshCareerSiteProjects().catch(() => {});
  }

  const watcherIds = await applyClientWatchers(project.id, input.clientId, input.requestType).catch(
    () => [] as string[],
  );
  await fanoutNewRequestNotifications({
    projectId: project.id,
    title,
    requestType: input.requestType,
    clientId: input.clientId,
    actorId: input.createdBy ?? null,
  }).catch(() => {});

  emitTasksChanged();
  return { project, watcherIds };
}

/** Summary counts for the Support tab header. */
export function summarizeQueue(rows: SupportRequestRollup[]): {
  open: number;
  unclaimed: number;
  overdue: number;
  waiting: number;
  closedLast30d: number;
} {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  let open = 0;
  let unclaimed = 0;
  let overdue = 0;
  let waiting = 0;
  let closedLast30d = 0;

  for (const r of rows) {
    if (r.rollupStatus === "closed") {
      const closedAt = r.project.updated_at ?? r.project.created_at;
      if (closedAt && closedAt >= cutoffIso) closedLast30d += 1;
      continue;
    }
    open += 1;
    if (r.unclaimedTasks > 0 || r.rollupStatus === "needs_triage") unclaimed += 1;
    if (r.overdueTasks > 0) overdue += 1;
    if (r.rollupStatus === "waiting") waiting += 1;
  }

  return { open, unclaimed, overdue, waiting, closedLast30d };
}

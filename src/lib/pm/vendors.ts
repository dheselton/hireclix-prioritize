/**
 * Vendor escalation tracking — registry, escalations, touchpoints, and scorecards.
 * Modeled on snippetIncidents.ts (one escalation → many client tickets).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import { createTask, updateTask } from "@/lib/pm/api";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { todayISO } from "@/lib/pm/format";
import type { TaskPriority, TaskStatus } from "@/types/pm";
import { TERMINAL_STATUSES } from "@/types/pm";

export type VendorCategory = "platform" | "ipaas" | "ats" | "hosting" | "other";
export type EscalationStatus =
  | "awaiting_vendor"
  | "awaiting_us"
  | "resolved"
  | "closed_unresolved";
export type EscalationSeverity = "low" | "medium" | "high" | "critical";
export type EscalationCategory =
  | "bug"
  | "outage"
  | "performance"
  | "feature_gap"
  | "billing"
  | "other";
export type TouchpointDirection = "outbound" | "inbound";
export type TouchpointChannel = "email" | "call" | "chat" | "portal" | "meeting";

export const ESCALATION_CATEGORIES: EscalationCategory[] = [
  "bug",
  "outage",
  "performance",
  "feature_gap",
  "billing",
  "other",
];

/** Calendar-day SLA targets by severity (response days, resolve days). */
export const SLA_DAYS_BY_SEVERITY: Record<EscalationSeverity, { response: number; resolve: number }> = {
  critical: { response: 1, resolve: 3 },
  high: { response: 2, resolve: 7 },
  medium: { response: 3, resolve: 14 },
  low: { response: 5, resolve: 30 },
};

export type VendorContact = { name?: string; email?: string; role?: string };

export type PmVendor = {
  id: string;
  name: string;
  category: VendorCategory;
  support_url: string | null;
  support_email: string | null;
  contacts: VendorContact[];
  follow_up_cadence_days: number;
  expected_first_response_days: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

export type PmVendorEscalation = {
  id: string;
  vendor_id: string;
  title: string;
  summary: string | null;
  description: string | null;
  vendor_ref: string | null;
  status: EscalationStatus;
  severity: EscalationSeverity;
  category: EscalationCategory | null;
  impact_summary: string | null;
  vendor_contact_name: string | null;
  vendor_contact_email: string | null;
  root_cause: string | null;
  expected_response_by: string | null;
  expected_resolve_by: string | null;
  response_breached_at: string | null;
  resolve_breached_at: string | null;
  owner_id: string | null;
  opened_at: string;
  last_outbound_at: string | null;
  first_response_at: string | null;
  last_inbound_at: string | null;
  next_follow_up_on: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PmVendorTouchpoint = {
  id: string;
  escalation_id: string;
  direction: TouchpointDirection;
  channel: TouchpointChannel;
  occurred_at: string;
  summary: string;
  thread_url: string | null;
  logged_by: string | null;
  created_at: string;
};

export type EscalationLinkedTask = {
  taskId: string;
  taskTitle: string;
  status: TaskStatus;
  assigneeId: string | null;
  projectId: string;
  projectTitle: string;
  clientId: string | null;
  clientName: string | null;
  dueDate: string | null;
};

export type EscalationWithRollup = PmVendorEscalation & {
  vendor: PmVendor;
  linkedTasks: EscalationLinkedTask[];
  openTaskCount: number;
  doneTaskCount: number;
  clientNames: string[];
  chaseCount: number;
  touchpoints?: PmVendorTouchpoint[];
};

export type VendorScorecard = {
  vendor: PmVendor;
  openEscalations: number;
  blockedClientTickets: number;
  medianFirstResponseDays: number | null;
  medianResolutionDays: number | null;
  unresolvedPast30d: number;
  avgChasesPerEscalation: number | null;
  oldestOpenAgeDays: number | null;
  responseBreachRate: number | null;
  resolveBreachRate: number | null;
};

export const VENDOR_CATEGORIES: VendorCategory[] = [
  "platform",
  "ipaas",
  "ats",
  "hosting",
  "other",
];

export const ESCALATION_STATUSES: EscalationStatus[] = [
  "awaiting_vendor",
  "awaiting_us",
  "resolved",
  "closed_unresolved",
];

export const OPEN_ESCALATION_STATUSES: EscalationStatus[] = [
  "awaiting_vendor",
  "awaiting_us",
];

export const TOUCHPOINT_CHANNELS: TouchpointChannel[] = [
  "email",
  "call",
  "chat",
  "portal",
  "meeting",
];

const DONE_STATUSES: TaskStatus[] = TERMINAL_STATUSES;

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA.slice(0, 10)}T00:00:00`);
  const b = new Date(`${isoB.slice(0, 10)}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function parseVendor(row: any): PmVendor {
  const contacts = Array.isArray(row.contacts) ? row.contacts : [];
  return {
    id: row.id,
    name: row.name,
    category: (row.category ?? "other") as VendorCategory,
    support_url: row.support_url ?? null,
    support_email: row.support_email ?? null,
    contacts,
    follow_up_cadence_days: row.follow_up_cadence_days ?? 3,
    expected_first_response_days: row.expected_first_response_days ?? null,
    notes: row.notes ?? null,
    active: row.active !== false,
    created_at: row.created_at,
  };
}

function parseEscalation(row: any): PmVendorEscalation {
  return {
    id: row.id,
    vendor_id: row.vendor_id,
    title: row.title,
    summary: row.summary ?? null,
    description: row.description ?? null,
    vendor_ref: row.vendor_ref ?? null,
    status: row.status as EscalationStatus,
    severity: (row.severity ?? "high") as EscalationSeverity,
    category: (row.category ?? null) as EscalationCategory | null,
    impact_summary: row.impact_summary ?? null,
    vendor_contact_name: row.vendor_contact_name ?? null,
    vendor_contact_email: row.vendor_contact_email ?? null,
    root_cause: row.root_cause ?? null,
    expected_response_by: row.expected_response_by ?? null,
    expected_resolve_by: row.expected_resolve_by ?? null,
    response_breached_at: row.response_breached_at ?? null,
    resolve_breached_at: row.resolve_breached_at ?? null,
    owner_id: row.owner_id ?? null,
    opened_at: row.opened_at,
    last_outbound_at: row.last_outbound_at ?? null,
    first_response_at: row.first_response_at ?? null,
    last_inbound_at: row.last_inbound_at ?? null,
    next_follow_up_on: row.next_follow_up_on ?? null,
    resolved_at: row.resolved_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseTouchpoint(row: any): PmVendorTouchpoint {
  return {
    id: row.id,
    escalation_id: row.escalation_id,
    direction: row.direction as TouchpointDirection,
    channel: (row.channel ?? "email") as TouchpointChannel,
    occurred_at: row.occurred_at,
    summary: row.summary,
    thread_url: row.thread_url ?? null,
    logged_by: row.logged_by ?? null,
    created_at: row.created_at,
  };
}

function addCalendarDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function slaTargetsForSeverity(
  severity: EscalationSeverity,
  vendor?: Pick<PmVendor, "expected_first_response_days"> | null,
): { responseDays: number; resolveDays: number } {
  const base = SLA_DAYS_BY_SEVERITY[severity] ?? SLA_DAYS_BY_SEVERITY.high;
  const responseDays =
    vendor?.expected_first_response_days != null && vendor.expected_first_response_days > 0
      ? vendor.expected_first_response_days
      : base.response;
  return { responseDays, resolveDays: base.resolve };
}

export function computeSlaDeadlines(
  openedAt: string,
  severity: EscalationSeverity,
  vendor?: Pick<PmVendor, "expected_first_response_days"> | null,
): { expected_response_by: string; expected_resolve_by: string } {
  const { responseDays, resolveDays } = slaTargetsForSeverity(severity, vendor);
  return {
    expected_response_by: addCalendarDays(openedAt, responseDays),
    expected_resolve_by: addCalendarDays(openedAt, resolveDays),
  };
}

export function isResponseBreached(
  esc: Pick<
    PmVendorEscalation,
    "expected_response_by" | "first_response_at" | "response_breached_at" | "status"
  >,
  now = new Date(),
): boolean {
  if (esc.response_breached_at) return true;
  if (!esc.expected_response_by) return false;
  const deadline = new Date(esc.expected_response_by).getTime();
  if (esc.first_response_at) {
    return new Date(esc.first_response_at).getTime() > deadline;
  }
  if (!isEscalationOpen(esc.status)) return false;
  return now.getTime() > deadline;
}

export function isResolveBreached(
  esc: Pick<
    PmVendorEscalation,
    "expected_resolve_by" | "resolved_at" | "resolve_breached_at" | "status"
  >,
  now = new Date(),
): boolean {
  if (esc.resolve_breached_at) return true;
  if (!esc.expected_resolve_by) return false;
  const deadline = new Date(esc.expected_resolve_by).getTime();
  if (esc.resolved_at) {
    return new Date(esc.resolved_at).getTime() > deadline;
  }
  if (!isEscalationOpen(esc.status)) return false;
  return now.getTime() > deadline;
}

export function slaLabel(
  esc: Pick<
    PmVendorEscalation,
    | "expected_response_by"
    | "expected_resolve_by"
    | "first_response_at"
    | "response_breached_at"
    | "resolve_breached_at"
    | "status"
    | "resolved_at"
  >,
): { response: string; resolve: string } {
  const respBreached = isResponseBreached(esc);
  const resBreached = isResolveBreached(esc);
  const response = !esc.expected_response_by
    ? "No response SLA"
    : esc.first_response_at
      ? respBreached
        ? "Response breached"
        : "Responded on time"
      : respBreached
        ? "Response overdue"
        : `Response due ${esc.expected_response_by.slice(0, 10)}`;
  const resolve = !esc.expected_resolve_by
    ? "No resolve SLA"
    : esc.resolved_at
      ? resBreached
        ? "Resolve breached"
        : "Resolved on time"
      : resBreached
        ? "Resolve overdue"
        : `Resolve due ${esc.expected_resolve_by.slice(0, 10)}`;
  return { response, resolve };
}

export function daysWaiting(escalation: Pick<PmVendorEscalation, "opened_at" | "resolved_at">, today = todayISO()): number {
  const end = escalation.resolved_at?.slice(0, 10) ?? today;
  return daysBetween(escalation.opened_at.slice(0, 10), end);
}

export function isFollowUpDue(
  escalation: Pick<PmVendorEscalation, "status" | "next_follow_up_on">,
  today = todayISO(),
): boolean {
  if (escalation.status !== "awaiting_vendor") return false;
  if (!escalation.next_follow_up_on) return false;
  return escalation.next_follow_up_on <= today;
}

export function isEscalationOpen(status: EscalationStatus): boolean {
  return OPEN_ESCALATION_STATUSES.includes(status);
}

export function isLinkedTaskDone(t: EscalationLinkedTask): boolean {
  return DONE_STATUSES.includes(t.status);
}

export function severityToPriority(s: EscalationSeverity): TaskPriority {
  return s === "critical" ? "urgent" : s === "low" ? "low" : s === "medium" ? "medium" : "high";
}

/** Outbound touchpoints since the last inbound (or all outbounds if never replied). */
export function chaseCount(touchpoints: PmVendorTouchpoint[]): number {
  if (!touchpoints.length) return 0;
  const sorted = [...touchpoints].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
  let lastInboundIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].direction === "inbound") {
      lastInboundIdx = i;
      break;
    }
  }
  return sorted.slice(lastInboundIdx + 1).filter((t) => t.direction === "outbound").length;
}

export async function fetchVendors(opts?: { includeInactive?: boolean }): Promise<PmVendor[]> {
  let q = supabase.from("pm_vendors").select("*").order("name");
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map(parseVendor);
}

export async function upsertVendor(
  input: Partial<PmVendor> & { name: string; id?: string },
): Promise<PmVendor> {
  const payload: any = {
    name: input.name,
    category: input.category ?? "other",
    support_url: input.support_url ?? null,
    support_email: input.support_email ?? null,
    contacts: input.contacts ?? [],
    follow_up_cadence_days: input.follow_up_cadence_days ?? 3,
    expected_first_response_days: input.expected_first_response_days ?? null,
    notes: input.notes ?? null,
    active: input.active !== false,
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("pm_vendors")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return parseVendor(data);
  }
  const { data, error } = await supabase.from("pm_vendors").insert(payload).select().single();
  if (error) throw error;
  return parseVendor(data);
}

export async function deactivateVendor(id: string): Promise<void> {
  const { error } = await supabase.from("pm_vendors").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export async function fetchEscalationTasks(escalationId: string): Promise<EscalationLinkedTask[]> {
  const { data, error } = await supabase
    .from("pm_vendor_escalation_tasks")
    .select(
      "task_id, pm_tasks(id, title, status, assignee_id, project_id, due_date, pm_projects(id, title, client_id, clients(name)))",
    )
    .eq("escalation_id", escalationId);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((row) => {
      const t = row.pm_tasks;
      if (!t) return null;
      const proj = t.pm_projects;
      return {
        taskId: t.id,
        taskTitle: t.title,
        status: t.status as TaskStatus,
        assigneeId: t.assignee_id,
        projectId: t.project_id,
        projectTitle: proj?.title ?? "Project",
        clientId: proj?.client_id ?? null,
        clientName: proj?.clients?.name ?? null,
        dueDate: t.due_date,
      } as EscalationLinkedTask;
    })
    .filter(Boolean)
    .sort((a, b) =>
      (a!.clientName ?? a!.projectTitle).localeCompare(b!.clientName ?? b!.projectTitle),
    ) as EscalationLinkedTask[];
}

export async function fetchTouchpoints(escalationId: string): Promise<PmVendorTouchpoint[]> {
  const { data, error } = await supabase
    .from("pm_vendor_touchpoints")
    .select("*")
    .eq("escalation_id", escalationId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map(parseTouchpoint);
}

async function fetchTouchpointsForEscalations(
  escalationIds: string[],
): Promise<Map<string, PmVendorTouchpoint[]>> {
  const map = new Map<string, PmVendorTouchpoint[]>();
  if (!escalationIds.length) return map;
  const { data, error } = await supabase
    .from("pm_vendor_touchpoints")
    .select("*")
    .in("escalation_id", escalationIds)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  for (const row of (data ?? []) as any[]) {
    const tp = parseTouchpoint(row);
    const list = map.get(tp.escalation_id) ?? [];
    list.push(tp);
    map.set(tp.escalation_id, list);
  }
  return map;
}

async function fetchLinkedTasksForEscalations(
  escalationIds: string[],
): Promise<Map<string, EscalationLinkedTask[]>> {
  const map = new Map<string, EscalationLinkedTask[]>();
  if (!escalationIds.length) return map;
  const { data, error } = await supabase
    .from("pm_vendor_escalation_tasks")
    .select(
      "escalation_id, task_id, pm_tasks(id, title, status, assignee_id, project_id, due_date, pm_projects(id, title, client_id, clients(name)))",
    )
    .in("escalation_id", escalationIds);
  if (error) throw error;
  for (const row of (data ?? []) as any[]) {
    const t = row.pm_tasks;
    if (!t) continue;
    const proj = t.pm_projects;
    const linked: EscalationLinkedTask = {
      taskId: t.id,
      taskTitle: t.title,
      status: t.status as TaskStatus,
      assigneeId: t.assignee_id,
      projectId: t.project_id,
      projectTitle: proj?.title ?? "Project",
      clientId: proj?.client_id ?? null,
      clientName: proj?.clients?.name ?? null,
      dueDate: t.due_date,
    };
    const list = map.get(row.escalation_id) ?? [];
    list.push(linked);
    map.set(row.escalation_id, list);
  }
  return map;
}

export async function fetchEscalations(opts?: {
  includeResolved?: boolean;
  vendorId?: string;
  ownerId?: string;
}): Promise<EscalationWithRollup[]> {
  let q = supabase
    .from("pm_vendor_escalations")
    .select("*, vendor:pm_vendors(*)")
    .order("opened_at", { ascending: false });
  if (!opts?.includeResolved) {
    q = q.in("status", OPEN_ESCALATION_STATUSES);
  }
  if (opts?.vendorId) q = q.eq("vendor_id", opts.vendorId);
  if (opts?.ownerId) q = q.eq("owner_id", opts.ownerId);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const ids = rows.map((r) => r.id as string);
  const [tasksByEsc, touchesByEsc] = await Promise.all([
    fetchLinkedTasksForEscalations(ids),
    fetchTouchpointsForEscalations(ids),
  ]);

  return rows.map((r) => {
    const escalation = parseEscalation(r);
    const vendor = parseVendor(r.vendor ?? { id: r.vendor_id, name: "Unknown", category: "other" });
    const linkedTasks = tasksByEsc.get(r.id) ?? [];
    const touchpoints = touchesByEsc.get(r.id) ?? [];
    const openTaskCount = linkedTasks.filter((t) => !isLinkedTaskDone(t)).length;
    const doneTaskCount = linkedTasks.length - openTaskCount;
    const clientNames = Array.from(
      new Set(linkedTasks.map((t) => t.clientName).filter((n): n is string => !!n)),
    ).sort();
    return {
      ...escalation,
      vendor,
      linkedTasks,
      openTaskCount,
      doneTaskCount,
      clientNames,
      chaseCount: chaseCount(touchpoints),
      touchpoints,
    };
  });
}

export async function fetchEscalation(id: string): Promise<EscalationWithRollup | null> {
  const { data, error } = await supabase
    .from("pm_vendor_escalations")
    .select("*, vendor:pm_vendors(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const escalation = parseEscalation(data);
  const vendor = parseVendor((data as any).vendor ?? { id: escalation.vendor_id, name: "Unknown" });
  const [linkedTasks, touchpoints] = await Promise.all([
    fetchEscalationTasks(id),
    fetchTouchpoints(id),
  ]);
  const openTaskCount = linkedTasks.filter((t) => !isLinkedTaskDone(t)).length;
  return {
    ...escalation,
    vendor,
    linkedTasks,
    openTaskCount,
    doneTaskCount: linkedTasks.length - openTaskCount,
    clientNames: Array.from(
      new Set(linkedTasks.map((t) => t.clientName).filter((n): n is string => !!n)),
    ).sort(),
    chaseCount: chaseCount(touchpoints),
    touchpoints,
  };
}

export type CreateEscalationSite = {
  projectId: string;
  projectTitle: string;
  assigneeId?: string | null;
};

export type CreateEscalationInput = {
  vendorId: string;
  title: string;
  summary: string;
  description?: string;
  vendorRef?: string | null;
  severity?: EscalationSeverity;
  category?: EscalationCategory | null;
  impactSummary?: string | null;
  vendorContactName?: string | null;
  vendorContactEmail?: string | null;
  ownerId?: string | null;
  sites?: CreateEscalationSite[];
  /** Existing task to link immediately (e.g. from task workspace). */
  linkTaskId?: string | null;
  blockLinkedTasks?: boolean;
};

export async function createEscalation(input: CreateEscalationInput): Promise<{
  escalation: PmVendorEscalation;
  taskIds: string[];
}> {
  const ownerId = input.ownerId ?? getCurrentUserId();
  const summary = input.summary.trim();
  if (!summary) throw new Error("Short description is required");

  const { data: vendorRow } = await supabase
    .from("pm_vendors")
    .select("*")
    .eq("id", input.vendorId)
    .maybeSingle();
  const vendor = vendorRow ? parseVendor(vendorRow) : null;
  const severity = input.severity ?? "high";
  const openedAt = new Date().toISOString();
  const sla = computeSlaDeadlines(openedAt, severity, vendor);

  const { data: escalation, error } = await supabase
    .from("pm_vendor_escalations")
    .insert({
      vendor_id: input.vendorId,
      title: input.title,
      summary,
      description: input.description || null,
      vendor_ref: input.vendorRef ?? null,
      severity,
      category: input.category ?? null,
      impact_summary: input.impactSummary?.trim() || null,
      vendor_contact_name: input.vendorContactName?.trim() || null,
      vendor_contact_email: input.vendorContactEmail?.trim() || null,
      owner_id: ownerId,
      status: "awaiting_vendor",
      opened_at: openedAt,
      next_follow_up_on: todayISO(),
      expected_response_by: sla.expected_response_by,
      expected_resolve_by: sla.expected_resolve_by,
    } as any)
    .select()
    .single();
  if (error) throw error;

  const esc = parseEscalation(escalation);
  const taskIds: string[] = [];
  const priority = severityToPriority(severity);
  const vendorName = vendor?.name ?? "vendor";

  const shouldBlock = input.blockLinkedTasks !== false;
  for (const site of input.sites ?? []) {
    const t = await createTask({
      project_id: site.projectId,
      title: `[Waiting on ${vendorName}] ${input.title} — ${site.projectTitle}`,
      description: summary,
      type: "dev",
      priority,
      assignee_id: site.assigneeId ?? null,
      status: (shouldBlock ? "blocked" : site.assigneeId ? "claimed" : "unclaimed") as TaskStatus,
      ...(shouldBlock ? { dev_blocker: `Waiting on ${vendorName}` } : {}),
    } as any);
    taskIds.push(t.id);
    await supabase.from("pm_vendor_escalation_tasks").insert({
      escalation_id: esc.id,
      task_id: t.id,
    });
  }

  if (input.linkTaskId) {
    await linkTaskToEscalation(esc.id, input.linkTaskId, {
      block: input.blockLinkedTasks !== false,
      vendorName,
    });
    taskIds.push(input.linkTaskId);
  }

  emitTasksChanged();
  return { escalation: esc, taskIds };
}

export async function updateEscalation(
  id: string,
  patch: Partial<
    Pick<
      PmVendorEscalation,
      | "title"
      | "summary"
      | "description"
      | "vendor_ref"
      | "severity"
      | "owner_id"
      | "status"
      | "next_follow_up_on"
      | "category"
      | "impact_summary"
      | "vendor_contact_name"
      | "vendor_contact_email"
      | "root_cause"
      | "expected_response_by"
      | "expected_resolve_by"
      | "response_breached_at"
      | "resolve_breached_at"
    >
  >,
): Promise<PmVendorEscalation> {
  let nextPatch: Record<string, unknown> = { ...patch };

  if (patch.severity !== undefined) {
    const { data: current } = await supabase
      .from("pm_vendor_escalations")
      .select("status, opened_at, first_response_at, vendor_id")
      .eq("id", id)
      .maybeSingle();
    if (current && isEscalationOpen((current as any).status)) {
      const { data: vendorRow } = await supabase
        .from("pm_vendors")
        .select("*")
        .eq("id", (current as any).vendor_id)
        .maybeSingle();
      const vendor = vendorRow ? parseVendor(vendorRow) : null;
      const sla = computeSlaDeadlines(
        (current as any).opened_at,
        patch.severity,
        vendor,
      );
      nextPatch = {
        ...nextPatch,
        expected_response_by: sla.expected_response_by,
        expected_resolve_by: sla.expected_resolve_by,
        ...(!(current as any).first_response_at ? { response_breached_at: null } : {}),
        resolve_breached_at: null,
      };
    }
  }

  const { data, error } = await supabase
    .from("pm_vendor_escalations")
    .update(nextPatch as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return parseEscalation(data);
}

export async function linkTaskToEscalation(
  escalationId: string,
  taskId: string,
  opts?: { block?: boolean; vendorName?: string },
): Promise<void> {
  const { error } = await supabase.from("pm_vendor_escalation_tasks").upsert({
    escalation_id: escalationId,
    task_id: taskId,
  });
  if (error) throw error;

  if (opts?.block !== false) {
    let vendorName = opts?.vendorName;
    if (!vendorName) {
      const esc = await fetchEscalation(escalationId);
      vendorName = esc?.vendor.name ?? "vendor";
    }
    await updateTask(taskId, {
      status: "blocked",
      dev_blocker: `Waiting on ${vendorName}`,
    } as any);
  }
  emitTasksChanged();
}

export async function unlinkTask(escalationId: string, taskId: string): Promise<void> {
  const { error } = await supabase
    .from("pm_vendor_escalation_tasks")
    .delete()
    .eq("escalation_id", escalationId)
    .eq("task_id", taskId);
  if (error) throw error;
  emitTasksChanged();
}

export async function addAffectedSites(
  escalationId: string,
  sites: CreateEscalationSite[],
): Promise<string[]> {
  const esc = await fetchEscalation(escalationId);
  if (!esc) throw new Error("Escalation not found");
  const priority = severityToPriority(esc.severity);
  const taskIds: string[] = [];
  for (const site of sites) {
    const t = await createTask({
      project_id: site.projectId,
      title: `[Waiting on ${esc.vendor.name}] ${esc.title} — ${site.projectTitle}`,
      description: esc.description,
      type: "dev",
      priority,
      status: "blocked" as TaskStatus,
      assignee_id: site.assigneeId ?? null,
      dev_blocker: `Waiting on ${esc.vendor.name}`,
    } as any);
    await supabase.from("pm_vendor_escalation_tasks").insert({
      escalation_id: escalationId,
      task_id: t.id,
    });
    taskIds.push(t.id);
  }
  emitTasksChanged();
  return taskIds;
}

export async function logTouchpoint(input: {
  escalationId: string;
  direction: TouchpointDirection;
  channel?: TouchpointChannel;
  summary: string;
  occurredAt?: string;
  threadUrl?: string | null;
}): Promise<PmVendorTouchpoint> {
  const { data, error } = await supabase
    .from("pm_vendor_touchpoints")
    .insert({
      escalation_id: input.escalationId,
      direction: input.direction,
      channel: input.channel ?? "email",
      summary: input.summary,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      thread_url: input.threadUrl?.trim() || null,
      logged_by: getCurrentUserId(),
    } as any)
    .select()
    .single();
  if (error) throw error;
  return parseTouchpoint(data);
}

export async function resolveEscalation(
  id: string,
  opts?: { unresolved?: boolean; advanceLinkedTasks?: boolean; rootCause?: string | null },
): Promise<void> {
  const status: EscalationStatus = opts?.unresolved ? "closed_unresolved" : "resolved";
  const resolvedAt = new Date().toISOString();

  const { data: current } = await supabase
    .from("pm_vendor_escalations")
    .select("expected_resolve_by, resolve_breached_at")
    .eq("id", id)
    .maybeSingle();

  let resolveBreachedAt = (current as any)?.resolve_breached_at ?? null;
  const expectedResolveBy = (current as any)?.expected_resolve_by as string | null;
  if (
    !resolveBreachedAt &&
    expectedResolveBy &&
    new Date(resolvedAt).getTime() > new Date(expectedResolveBy).getTime()
  ) {
    resolveBreachedAt = resolvedAt;
  }

  const { error } = await supabase
    .from("pm_vendor_escalations")
    .update({
      status,
      resolved_at: resolvedAt,
      next_follow_up_on: null,
      root_cause: opts?.rootCause?.trim() || null,
      resolve_breached_at: resolveBreachedAt,
    } as any)
    .eq("id", id);
  if (error) throw error;

  if (opts?.advanceLinkedTasks) {
    const tasks = await fetchEscalationTasks(id);
    for (const t of tasks) {
      if (DONE_STATUSES.includes(t.status)) continue;
      if (t.status === "blocked") {
        await updateTask(t.taskId, {
          status: "in_progress",
          dev_blocker: null,
        } as any);
      }
    }
  }
  emitTasksChanged();
}

export async function reopenEscalation(id: string): Promise<void> {
  const { error } = await supabase
    .from("pm_vendor_escalations")
    .update({
      status: "awaiting_vendor",
      resolved_at: null,
      next_follow_up_on: todayISO(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Task IDs currently linked to any open vendor escalation. */
export async function fetchOpenVendorBlockedTaskIds(): Promise<Set<string>> {
  const { data: openEsc, error: e1 } = await supabase
    .from("pm_vendor_escalations")
    .select("id")
    .in("status", OPEN_ESCALATION_STATUSES);
  if (e1) throw e1;
  const ids = ((openEsc ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return new Set();
  const { data: links, error: e2 } = await supabase
    .from("pm_vendor_escalation_tasks")
    .select("task_id")
    .in("escalation_id", ids);
  if (e2) throw e2;
  return new Set(((links ?? []) as { task_id: string }[]).map((r) => r.task_id));
}

/** Open escalation for a task, if any. */
export async function fetchEscalationForTask(
  taskId: string,
): Promise<EscalationWithRollup | null> {
  const { data, error } = await supabase
    .from("pm_vendor_escalation_tasks")
    .select("escalation_id")
    .eq("task_id", taskId)
    .limit(1);
  if (error) throw error;
  const escId = ((data ?? []) as { escalation_id: string }[])[0]?.escalation_id;
  if (!escId) return null;
  return fetchEscalation(escId);
}

export async function countFollowUpsDueForOwner(
  ownerId: string,
  today = todayISO(),
): Promise<number> {
  const { count, error } = await supabase
    .from("pm_vendor_escalations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("status", "awaiting_vendor")
    .lte("next_follow_up_on", today)
    .not("next_follow_up_on", "is", null);
  if (error) throw error;
  return count ?? 0;
}

export function computeVendorScorecard(
  vendor: PmVendor,
  escalations: EscalationWithRollup[],
  today = todayISO(),
): VendorScorecard {
  const forVendor = escalations.filter((e) => e.vendor_id === vendor.id);
  const open = forVendor.filter((e) => isEscalationOpen(e.status));
  const blockedClientTickets = open.reduce((n, e) => n + e.openTaskCount, 0);

  const firstResponseDays = forVendor
    .filter((e) => e.first_response_at)
    .map((e) => daysBetween(e.opened_at.slice(0, 10), e.first_response_at!.slice(0, 10)));

  const resolutionDays = forVendor
    .filter((e) => e.resolved_at)
    .map((e) => daysBetween(e.opened_at.slice(0, 10), e.resolved_at!.slice(0, 10)));

  const unresolvedPast30d = open.filter((e) => daysWaiting(e, today) >= 30).length;

  const chaseTotals = forVendor.map((e) => e.chaseCount);
  const avgChases =
    chaseTotals.length === 0
      ? null
      : chaseTotals.reduce((a, b) => a + b, 0) / chaseTotals.length;

  const oldestOpenAgeDays =
    open.length === 0 ? null : Math.max(...open.map((e) => daysWaiting(e, today)));

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const recent = forVendor.filter((e) => new Date(e.opened_at).getTime() >= cutoff.getTime());
  const withResponseDeadline = recent.filter((e) => e.expected_response_by || e.first_response_at || e.response_breached_at);
  const responseBreaches = withResponseDeadline.filter((e) => isResponseBreached(e)).length;
  const withResolveDeadline = recent.filter(
    (e) => e.expected_resolve_by || e.resolved_at || e.resolve_breached_at,
  );
  const resolveBreaches = withResolveDeadline.filter((e) => isResolveBreached(e)).length;

  return {
    vendor,
    openEscalations: open.length,
    blockedClientTickets,
    medianFirstResponseDays: median(firstResponseDays),
    medianResolutionDays: median(resolutionDays),
    unresolvedPast30d,
    avgChasesPerEscalation: avgChases == null ? null : Math.round(avgChases * 10) / 10,
    oldestOpenAgeDays,
    responseBreachRate:
      withResponseDeadline.length === 0
        ? null
        : Math.round((responseBreaches / withResponseDeadline.length) * 100),
    resolveBreachRate:
      withResolveDeadline.length === 0
        ? null
        : Math.round((resolveBreaches / withResolveDeadline.length) * 100),
  };
}

export async function fetchVendorScorecards(): Promise<VendorScorecard[]> {
  const [vendors, escalations] = await Promise.all([
    fetchVendors({ includeInactive: true }),
    fetchEscalations({ includeResolved: true }),
  ]);
  return vendors
    .filter((v) => v.active || escalations.some((e) => e.vendor_id === v.id))
    .map((v) => computeVendorScorecard(v, escalations))
    .sort((a, b) => b.openEscalations - a.openEscalations || a.vendor.name.localeCompare(b.vendor.name));
}

/* ── react-query hooks ─────────────────────────────────────────────────────── */

export function useVendors(includeInactive = false) {
  return useQuery({
    queryKey: ["pm-vendors", includeInactive],
    queryFn: () => fetchVendors({ includeInactive }),
    staleTime: 60_000,
  });
}

export function useEscalations(opts?: {
  includeResolved?: boolean;
  vendorId?: string;
  ownerId?: string;
}) {
  return useQuery({
    queryKey: [
      "pm-vendor-escalations",
      opts?.includeResolved ?? false,
      opts?.vendorId ?? null,
      opts?.ownerId ?? null,
    ],
    queryFn: () => fetchEscalations(opts),
    staleTime: 15_000,
  });
}

export function useEscalation(id: string | null | undefined) {
  return useQuery({
    queryKey: ["pm-vendor-escalation", id],
    queryFn: () => fetchEscalation(id!),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useEscalationForTask(taskId: string | null | undefined) {
  return useQuery({
    queryKey: ["pm-vendor-escalation-for-task", taskId],
    queryFn: () => fetchEscalationForTask(taskId!),
    enabled: !!taskId,
    staleTime: 15_000,
  });
}

export function useOpenVendorBlockedTaskIds() {
  return useQuery({
    queryKey: ["pm-vendor-blocked-task-ids"],
    queryFn: fetchOpenVendorBlockedTaskIds,
    staleTime: 30_000,
  });
}

export function useVendorScorecards() {
  return useQuery({
    queryKey: ["pm-vendor-scorecards"],
    queryFn: fetchVendorScorecards,
    staleTime: 60_000,
  });
}

export function useVendorFollowUpsDue(ownerId: string | null | undefined) {
  return useQuery({
    queryKey: ["pm-vendor-follow-ups-due", ownerId],
    queryFn: () => countFollowUpsDueForOwner(ownerId!),
    enabled: !!ownerId,
    staleTime: 30_000,
  });
}

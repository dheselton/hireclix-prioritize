import { useEffect, useState, useCallback } from "react";
import { format, isSameDay, isYesterday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { localDateISO } from "@/lib/pm/format";

export { localDateISO };

export interface TimeEntry {
  id: string;
  task_id: string | null;
  activity_id: string | null;
  user_id: string;
  minutes: number;
  note: string | null;
  logged_at: string;
  billable: boolean;
  started_at: string | null;
  ended_at: string | null;
}

export interface EnrichedEntry extends TimeEntry {
  task_title: string;
  project_id: string;
  project_title: string;
  client_id: string | null;
  client_name: string | null;
  task_type: string | null;
  task_track: string | null;
  activity_name: string | null;
  activity_color: string | null;
  activity_icon: string | null;
  /** True when this entry is an overhead activity (no task). */
  is_activity: boolean;
}

export function fmtDur(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Manual date-picker logs are stored at noon with no real clock range. */
function isDateOnlyLoggedAt(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const localNoon = d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0;
  const utcNoon = d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return localNoon || utcNoon;
}

export function entryInterval(e: Pick<TimeEntry, "minutes" | "logged_at" | "started_at" | "ended_at">): { start: Date; end: Date } | null {
  if (e.started_at && e.ended_at) {
    const start = new Date(e.started_at);
    const end = new Date(e.ended_at);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) return { start, end };
  }
  if (isDateOnlyLoggedAt(e.logged_at)) return null;
  const end = new Date(e.logged_at);
  if (Number.isNaN(end.getTime())) return null;
  return { start: new Date(end.getTime() - e.minutes * 60_000), end };
}

export function fmtEntryRange(e: Pick<TimeEntry, "minutes" | "logged_at" | "started_at" | "ended_at">): string {
  const range = entryInterval(e);
  const dur = fmtDur(e.minutes);
  if (!range) {
    try {
      return `${format(new Date(e.logged_at), "EEE, MMM d")} · ${dur}`;
    } catch {
      return dur;
    }
  }
  const { start, end } = range;
  if (isSameDay(start, end)) {
    return `${format(start, "EEE, MMM d")} · ${format(start, "h:mm a")} – ${format(end, "h:mm a")} · ${dur}`;
  }
  return `${format(start, "EEE, MMM d, h:mm a")} – ${format(end, "EEE, MMM d, h:mm a")} · ${dur}`;
}

export function fmtEntryWhen(e: Pick<TimeEntry, "minutes" | "logged_at" | "started_at" | "ended_at">): string {
  const range = entryInterval(e);
  if (!range) {
    try {
      return format(new Date(e.logged_at), "EEE, MMM d");
    } catch {
      return "";
    }
  }
  const { start, end } = range;
  if (isSameDay(start, end)) {
    return `${format(start, "EEE, MMM d")}, ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
  }
  return `${format(start, "EEE, MMM d, h:mm a")} – ${format(end, "EEE, MMM d, h:mm a")}`;
}

export function fmtLastTracked(end: Date): string {
  const time = format(end, "h:mm a");
  if (isSameDay(end, new Date())) return `Today at ${time}`;
  if (isYesterday(end)) return `Yesterday at ${time}`;
  return `${format(end, "EEE, MMM d")} at ${time}`;
}

export function entryEndTime(e: Pick<TimeEntry, "logged_at" | "started_at" | "ended_at" | "minutes">): Date | null {
  const range = entryInterval(e);
  if (range) return range.end;
  const d = new Date(e.logged_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sunday-start week containing `d`. Returns ISO yyyy-mm-dd for each of 7 days. */
export function weekDays(d: Date): string[] {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return localDateISO(x);
  });
}

export function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}



/** Fetch entries with task/project/client + activity joined. */
export async function fetchEnrichedEntries(opts: {
  userId?: string | null;
  userIds?: string[];
  taskId?: string;
  activityId?: string;
  /** When set, only entries whose task belongs to this project (excludes overhead). */
  projectId?: string;
  from?: string; // ISO date inclusive
  to?: string;   // ISO date inclusive
}): Promise<EnrichedEntry[]> {
  let taskIdsForProject: string[] | null = null;
  if (opts.projectId) {
    const { data: tasks, error: taskErr } = await supabase
      .from("pm_tasks")
      .select("id")
      .eq("project_id", opts.projectId);
    if (taskErr) throw taskErr;
    taskIdsForProject = ((tasks as { id: string }[]) ?? []).map((t) => t.id);
    if (!taskIdsForProject.length) return [];
  }

  const mapRow = (r: any): EnrichedEntry => {
    const isActivity = !!r.activity_id;
    return {
      id: r.id,
      task_id: r.task_id,
      activity_id: r.activity_id,
      user_id: r.user_id,
      minutes: r.minutes,
      note: r.note,
      logged_at: r.logged_at,
      started_at: r.started_at ?? null,
      ended_at: r.ended_at ?? null,
      billable: r.billable ?? true,
      task_title: isActivity ? (r.pm_activities?.name ?? "Activity") : (r.pm_tasks?.title ?? "Untitled task"),
      task_type: r.pm_tasks?.type ?? null,
      task_track: r.pm_tasks?.track ?? null,
      project_id: r.pm_tasks?.project_id ?? "",
      project_title: r.pm_tasks?.pm_projects?.title ?? "",
      client_id: isActivity ? (r.pm_activities?.default_client_id ?? null) : (r.pm_tasks?.pm_projects?.client_id ?? null),
      client_name: isActivity ? (r.pm_activities?.clients?.name ?? null) : (r.pm_tasks?.pm_projects?.clients?.name ?? null),
      activity_name: r.pm_activities?.name ?? null,
      activity_color: r.pm_activities?.color ?? null,
      activity_icon: r.pm_activities?.icon ?? null,
      is_activity: isActivity,
    };
  };

  const selectCols =
    "id, task_id, activity_id, user_id, minutes, note, logged_at, started_at, ended_at, billable, pm_tasks(title, type, track, project_id, pm_projects(title, client_id, clients(name))), pm_activities(name, color, icon, default_client_id, clients(name))";

  async function runQuery(extra?: { taskIds?: string[] }) {
    let q = supabase.from("pm_time_entries").select(selectCols);
    if (opts.userId) q = q.eq("user_id", opts.userId);
    if (opts.userIds?.length) q = q.in("user_id", opts.userIds);
    if (opts.taskId) q = q.eq("task_id", opts.taskId);
    if (opts.activityId) q = q.eq("activity_id", opts.activityId);
    if (extra?.taskIds) q = q.in("task_id", extra.taskIds);
    if (opts.from) q = q.gte("logged_at", `${opts.from}T00:00:00`);
    if (opts.to) q = q.lte("logged_at", `${opts.to}T23:59:59.999`);
    const { data, error } = await q.order("logged_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRow);
  }

  if (taskIdsForProject) {
    const CHUNK = 200;
    const out: EnrichedEntry[] = [];
    for (let i = 0; i < taskIdsForProject.length; i += CHUNK) {
      const slice = taskIdsForProject.slice(i, i + CHUNK);
      out.push(...(await runQuery({ taskIds: slice })));
    }
    out.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    return out;
  }

  return runQuery();
}

export async function addTimeEntry(input: {
  task_id?: string | null;
  activity_id?: string | null;
  user_id: string;
  minutes: number;
  note?: string;
  logged_at?: string; // ISO date or full timestamp
  billable?: boolean;
}) {
  if (!input.task_id && !input.activity_id) throw new Error("task_id or activity_id required");
  if (input.task_id && input.activity_id) throw new Error("Provide either task_id OR activity_id, not both");
  const logged_at = input.logged_at
    ? (input.logged_at.length === 10 ? `${input.logged_at}T12:00:00` : input.logged_at)
    : new Date().toISOString();
  const { data, error } = await supabase
    .from("pm_time_entries")
    .insert({
      task_id: input.task_id ?? null,
      activity_id: input.activity_id ?? null,
      user_id: input.user_id,
      minutes: input.minutes,
      note: input.note ?? "",
      logged_at,
      billable: input.billable ?? true,
    } as any)
    .select()
    .single();
  if (error) throw error;
  emitTimeChanged();
  return data;
}

export async function updateTimeEntry(id: string, patch: Partial<Pick<TimeEntry, "minutes" | "note" | "logged_at" | "billable">>) {
  const { error } = await supabase.from("pm_time_entries").update(patch as any).eq("id", id);
  if (error) throw error;
  emitTimeChanged();
}

export async function deleteTimeEntry(id: string) {
  const { error } = await supabase.from("pm_time_entries").delete().eq("id", id);
  if (error) throw error;
  emitTimeChanged();
}

// pub/sub so all time views refresh when entries change
const timeSubs = new Set<() => void>();
export function emitTimeChanged() { timeSubs.forEach(fn => { try { fn(); } catch {} }); }
export function useTimeChanged(handler: () => void) {
  useEffect(() => {
    timeSubs.add(handler);
    return () => { timeSubs.delete(handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Convenience hook to load + auto-refresh entries. */
export function useEnrichedEntries(opts: Parameters<typeof fetchEnrichedEntries>[0], deps: any[] = []) {
  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fetchEnrichedEntries(opts)
      .then(setEntries)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  useTimeChanged(reload);
  return { entries, loading, reload };
}

export interface WeekGridRow {
  rowKey: string;
  taskId: string | null;
  activityId: string | null;
  taskTitle: string;        // display label (task title OR activity name)
  taskType: string | null;
  projectId: string;
  projectTitle: string;
  clientName: string | null;
  activityColor: string | null;
  activityIcon: string | null;
  isActivity: boolean;
  perDay: number[]; // length 7
  total: number;
  entries: EnrichedEntry[];
}

export function buildWeekGrid(entries: EnrichedEntry[], days: string[]): { rows: WeekGridRow[]; dayTotals: number[]; total: number } {
  const map = new Map<string, WeekGridRow>();
  for (const e of entries) {
    const day = e.logged_at.slice(0, 10);
    const idx = days.indexOf(day);
    if (idx < 0) continue;
    const key = e.is_activity ? `a:${e.activity_id}` : `t:${e.task_id}`;
    let row = map.get(key);
    if (!row) {
      row = {
        rowKey: key,
        taskId: e.task_id,
        activityId: e.activity_id,
        taskTitle: e.is_activity ? (e.activity_name ?? "Activity") : e.task_title,
        taskType: e.task_type,
        projectId: e.project_id,
        projectTitle: e.project_title,
        clientName: e.client_name,
        activityColor: e.activity_color,
        activityIcon: e.activity_icon,
        isActivity: e.is_activity,
        perDay: Array(7).fill(0),
        total: 0,
        entries: [],
      };
      map.set(key, row);
    }
    row.perDay[idx] += e.minutes;
    row.total += e.minutes;
    row.entries.push(e);
  }
  const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const dayTotals = Array(7).fill(0);
  rows.forEach(r => r.perDay.forEach((v, i) => { dayTotals[i] += v; }));
  const total = dayTotals.reduce((s, v) => s + v, 0);
  return { rows, dayTotals, total };
}

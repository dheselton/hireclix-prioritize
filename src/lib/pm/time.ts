import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimeEntry {
  id: string;
  task_id: string | null;
  activity_id: string | null;
  user_id: string;
  minutes: number;
  note: string | null;
  logged_at: string;
  billable: boolean;
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

/** Sunday-start week containing `d`. Returns ISO yyyy-mm-dd for each of 7 days. */
export function weekDays(d: Date): string[] {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x.toISOString().slice(0, 10);
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

export function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fetch entries with task/project/client joined. */
export async function fetchEnrichedEntries(opts: {
  userId?: string | null;
  userIds?: string[];
  taskId?: string;
  from?: string; // ISO date inclusive
  to?: string;   // ISO date inclusive
}): Promise<EnrichedEntry[]> {
  let q = supabase
    .from("pm_time_entries")
    .select(
      "id, task_id, user_id, minutes, note, logged_at, billable, pm_tasks(title, type, track, project_id, pm_projects(title, client_id, clients(name)))"
    );
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.userIds?.length) q = q.in("user_id", opts.userIds);
  if (opts.taskId) q = q.eq("task_id", opts.taskId);
  if (opts.from) q = q.gte("logged_at", `${opts.from}T00:00:00`);
  if (opts.to) q = q.lte("logged_at", `${opts.to}T23:59:59.999`);
  const { data, error } = await q.order("logged_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id,
    task_id: r.task_id,
    user_id: r.user_id,
    minutes: r.minutes,
    note: r.note,
    logged_at: r.logged_at,
    billable: r.billable ?? true,
    task_title: r.pm_tasks?.title ?? "Untitled task",
    task_type: r.pm_tasks?.type ?? null,
    task_track: r.pm_tasks?.track ?? null,
    project_id: r.pm_tasks?.project_id ?? "",
    project_title: r.pm_tasks?.pm_projects?.title ?? "",
    client_id: r.pm_tasks?.pm_projects?.client_id ?? null,
    client_name: r.pm_tasks?.pm_projects?.clients?.name ?? null,
  }));
}

export async function addTimeEntry(input: {
  task_id: string;
  user_id: string;
  minutes: number;
  note?: string;
  logged_at?: string; // ISO date or full timestamp
  billable?: boolean;
}) {
  const logged_at = input.logged_at
    ? (input.logged_at.length === 10 ? `${input.logged_at}T12:00:00` : input.logged_at)
    : new Date().toISOString();
  const { data, error } = await supabase
    .from("pm_time_entries")
    .insert({
      task_id: input.task_id,
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
  taskId: string;
  taskTitle: string;
  taskType: string | null;
  projectId: string;
  projectTitle: string;
  clientName: string | null;
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
    let row = map.get(e.task_id);
    if (!row) {
      row = {
        taskId: e.task_id,
        taskTitle: e.task_title,
        taskType: e.task_type,
        projectId: e.project_id,
        projectTitle: e.project_title,
        clientName: e.client_name,
        perDay: Array(7).fill(0),
        total: 0,
        entries: [],
      };
      map.set(e.task_id, row);
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

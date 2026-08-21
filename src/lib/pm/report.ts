/**
 * Team Report data helpers (/pm/report).
 *
 * Everything is derived client-side from the tasks/projects/clients we already
 * fetch elsewhere, plus a single windowed read of pm_activity_log for
 * "movement" and "last activity". No charts — just counted sets that each
 * screen can open.
 */
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateISO } from "@/lib/pm/format";
import { isDone, type PmProject, type PmTask } from "@/types/pm";
import { useQuery } from "@tanstack/react-query";
import { useProjectsQuery, useTasksQuery } from "@/lib/pm/queries";

/** Monday 00:00 local of the current week. */
export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Days since an ISO timestamp, or null. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export const isOverdue = (t: PmTask, today = startOfToday()) =>
  !!t.due_date && !isDone(t.status) && new Date(`${t.due_date}T00:00:00`) < today;

export interface ReportData {
  loading: boolean;
  error: boolean;
  reload: () => void;
  tasks: PmTask[];
  projects: PmProject[];
  clientNames: Map<string, string>;
  /** project_id -> most recent activity timestamp (ISO) within the lookback window. */
  lastActivity: Map<string, string>;
  weekStart: Date;
}

/** One fetch pass for the whole report page. */
export function useReportData(): ReportData {
  const tasksQuery = useTasksQuery();
  const projectsQuery = useProjectsQuery();
  const clientsQuery = useQuery({
    queryKey: ["pm", "clients", "names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name");
      if (error) throw error;
      return new Map((data ?? []).map(row => [row.id, row.name] as const));
    },
  });
  const activityQuery = useQuery({
    queryKey: ["pm", "report", "activity", "30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("pm_activity_log")
        .select("project_id,created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(4000);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        if (row.project_id && !map.has(row.project_id)) map.set(row.project_id, row.created_at);
      }
      return map;
    },
  });
  const weekStart = useMemo(() => startOfWeek(), []);
  return {
    loading: tasksQuery.isPending || projectsQuery.isPending || clientsQuery.isPending || activityQuery.isPending,
    error: tasksQuery.isError || projectsQuery.isError || clientsQuery.isError || activityQuery.isError,
    reload: () => {
      void tasksQuery.refetch();
      void projectsQuery.refetch();
      void clientsQuery.refetch();
      void activityQuery.refetch();
    },
    tasks: tasksQuery.data ?? [],
    projects: projectsQuery.data ?? [],
    clientNames: clientsQuery.data ?? new Map<string, string>(),
    lastActivity: activityQuery.data ?? new Map<string, string>(),
    weekStart,
  };
}

export interface RiskReason { label: string; }

export interface AtRiskProject {
  project: PmProject;
  clientName: string | null;
  overdue: number;
  blocked: number;
  lastActivityIso: string | null;
  staleDays: number | null;
  reasons: string[];
}

/**
 * At risk = go-live within 14 days AND has overdue work, OR >= 2 blocked
 * tasks, OR no activity for 5+ days while open work remains.
 */
export function computeAtRisk(
  projects: PmProject[],
  tasks: PmTask[],
  clientNames: Map<string, string>,
  lastActivity: Map<string, string>,
): AtRiskProject[] {
  const today = startOfToday();
  const byProject = new Map<string, PmTask[]>();
  for (const t of tasks) {
    const arr = byProject.get(t.project_id);
    arr ? arr.push(t) : byProject.set(t.project_id, [t]);
  }

  const out: AtRiskProject[] = [];
  for (const p of projects) {
    if (p.status === "complete" || p.status === "archived") continue;
    const list = byProject.get(p.id) ?? [];
    const open = list.filter(t => !isDone(t.status));
    if (!open.length) continue;

    const overdue = list.filter(t => isOverdue(t, today)).length;
    const blocked = list.filter(t => t.status === "blocked").length;
    const lastIso = lastActivity.get(p.id) ?? p.updated_at ?? null;
    const stale = daysSince(lastIso);

    const reasons: string[] = [];
    if (p.go_live_date) {
      const gl = new Date(`${p.go_live_date}T00:00:00`);
      const days = Math.round((gl.getTime() - today.getTime()) / 86_400_000);
      if (days <= 14 && overdue > 0) {
        reasons.push(days < 0 ? "Past go-live with overdue work" : `Go-live in ${days}d with overdue work`);
      }
    }
    if (blocked >= 2) reasons.push(`${blocked} blocked tasks`);
    if (stale !== null && stale >= 5) reasons.push(`No movement in ${stale} days`);

    if (reasons.length) {
      out.push({
        project: p,
        clientName: p.client_id ? clientNames.get(p.client_id) ?? null : null,
        overdue,
        blocked,
        lastActivityIso: lastIso,
        staleDays: stale,
        reasons,
      });
    }
  }

  // Worst first: overdue, then blocked, then staleness.
  return out.sort((a, b) =>
    b.overdue - a.overdue || b.blocked - a.blocked || (b.staleDays ?? 0) - (a.staleDays ?? 0));
}

/** YYYY-MM-DD of the week start, handy for date comparisons. */
export const weekStartISO = () => localDateISO(startOfWeek());

/**
 * Data layer for the internal "My Work" portal (/pm/my-work).
 *
 * PORTAL-2. Read-only aggregation over tasks, form submissions and portal
 * messages for the *current* user. Nothing here writes.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isDone, type PmProject, type PmTask } from "@/types/pm";
import { todayISO } from "@/lib/pm/format";

/* ------------------------------------------------------------------ tasks */

export type MyTaskGroupId = "attention" | "in_progress" | "up_next";

export interface MyTasksData {
  attention: PmTask[];
  inProgress: PmTask[];
  upNext: PmTask[];
  recentlyCompleted: PmTask[];
  projects: Map<string, PmProject>;
  loading: boolean;
  reload: () => void;
}

export function groupMyTask(t: PmTask): MyTaskGroupId {
  const today = todayISO();
  if (t.status === "blocked") return "attention";
  if (t.due_date && t.due_date < today) return "attention";
  if (t.status === "in_progress" || t.status === "in_review") return "in_progress";
  return "up_next";
}

export function useMyTasks(userId: string | null): MyTasksData {
  const [rows, setRows] = useState<PmTask[]>([]);
  const [doneRows, setDoneRows] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<Map<string, PmProject>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setRows([]); setDoneRows([]); setLoading(false); return; }
    setLoading(true);
    const [openRes, doneRes] = await Promise.all([
      supabase.from("pm_tasks").select("*").eq("assignee_id", userId).order("due_date", { ascending: true }),
      supabase.from("pm_tasks").select("*").eq("assignee_id", userId)
        .in("status", ["complete", "approved"]).order("updated_at", { ascending: false }).limit(20),
    ]);
    const open = (((openRes.data ?? []) as unknown) as PmTask[]).filter(t => !isDone(t.status));
    const done = ((doneRes.data ?? []) as unknown) as PmTask[];
    setRows(open); setDoneRows(done);

    const ids = [...new Set([...open, ...done].map(t => t.project_id).filter(Boolean))];
    if (ids.length) {
      const { data } = await supabase.from("pm_projects").select("*").in("id", ids);
      setProjects(new Map((((data ?? []) as unknown) as PmProject[]).map(p => [p.id, p])));
    } else {
      setProjects(new Map());
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return {
    attention: rows.filter(t => groupMyTask(t) === "attention"),
    inProgress: rows.filter(t => groupMyTask(t) === "in_progress"),
    upNext: rows.filter(t => groupMyTask(t) === "up_next"),
    recentlyCompleted: doneRows,
    projects,
    loading,
    reload: load,
  };
}

/* --------------------------------------------------------------- requests */

export interface MyRequest {
  id: string;
  title: string;
  requestType: string | null;
  status: string;
  createdAt: string;
  projectId: string | null;
  taskId: string | null;
  payload: Record<string, any>;
  submitterName: string | null;
  submitterEmail: string | null;
}

export function requestRef(r: MyRequest): string {
  const base = r.projectId ?? r.taskId ?? r.id;
  return `REQ-${base.slice(-6).toUpperCase()}`;
}

function toRequest(row: any): MyRequest {
  const payload = (row.payload ?? {}) as Record<string, any>;
  return {
    id: row.id,
    title: payload.title ?? payload.request_title ?? "Untitled request",
    requestType: payload.request_type ?? null,
    status: row.status ?? "new",
    createdAt: row.created_at,
    projectId: row.created_project_id ?? null,
    taskId: row.created_task_id ?? null,
    payload,
    submitterName: row.submitter_name ?? null,
    submitterEmail: row.submitter_email ?? null,
  };
}

export function useMyRequests(userId: string | null, email: string | null) {
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId && !email) { setRequests([]); setLoading(false); return; }
    setLoading(true);

    // Projects I requested — catches submissions made on my behalf.
    let myProjectIds: string[] = [];
    if (userId) {
      const { data } = await supabase.from("pm_projects").select("id").eq("requested_by", userId);
      myProjectIds = (data ?? []).map((r: any) => r.id);
    }

    const seen = new Map<string, MyRequest>();
    if (email) {
      const { data } = await supabase.from("pm_form_submissions").select("*")
        .eq("submitter_email", email).order("created_at", { ascending: false }).limit(100);
      for (const row of data ?? []) seen.set(row.id, toRequest(row));
    }
    if (myProjectIds.length) {
      const { data } = await supabase.from("pm_form_submissions").select("*")
        .in("created_project_id", myProjectIds).order("created_at", { ascending: false }).limit(100);
      for (const row of data ?? []) seen.set(row.id, toRequest(row));
    }

    setRequests([...seen.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }, [userId, email]);

  useEffect(() => { load(); }, [load]);
  return { requests, loading, reload: load };
}

export interface RequestTimelineEntry {
  id: string;
  action: string;
  createdAt: string;
  payload: Record<string, any> | null;
}

/** Status history for one request, from pm_activity_log. */
export async function fetchRequestTimeline(req: MyRequest): Promise<RequestTimelineEntry[]> {
  const out: RequestTimelineEntry[] = [];
  if (req.projectId) {
    const { data } = await supabase.from("pm_activity_log").select("id, action, created_at, payload")
      .eq("project_id", req.projectId).order("created_at", { ascending: false }).limit(40);
    for (const r of data ?? []) out.push({ id: r.id, action: r.action, createdAt: r.created_at, payload: (r.payload ?? null) as any });
  } else if (req.taskId) {
    const { data } = await supabase.from("pm_activity_log").select("id, action, created_at, payload")
      .eq("task_id", req.taskId).order("created_at", { ascending: false }).limit(40);
    for (const r of data ?? []) out.push({ id: r.id, action: r.action, createdAt: r.created_at, payload: (r.payload ?? null) as any });
  }
  return out;
}

export interface RequestFile { id: string; name: string; url: string; createdAt: string }

export async function fetchRequestFiles(req: MyRequest): Promise<RequestFile[]> {
  if (!req.projectId) return [];
  const { data } = await supabase.from("pm_project_attachments")
    .select("id, name, url, created_at").eq("project_id", req.projectId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, url: r.url, createdAt: r.created_at }));
}

/* --------------------------------------------------------------- messages */

export interface MessageThreadSummary {
  projectId: string;
  projectTitle: string;
  clientName: string | null;
  lastBody: string;
  lastAuthor: string;
  lastAt: string;
  unread: number;
}

export function portalReadKey(userId: string, projectId: string) {
  return `portalLastRead_${userId}_${projectId}`;
}

export function markThreadRead(userId: string, projectId: string) {
  try { localStorage.setItem(portalReadKey(userId, projectId), new Date().toISOString()); } catch { /* ignore */ }
}

export function useMyMessageThreads(userId: string | null) {
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setThreads([]); setLoading(false); return; }
    setLoading(true);

    const [memberRes, requestedRes] = await Promise.all([
      supabase.from("pm_project_members").select("project_id").eq("user_id", userId),
      supabase.from("pm_projects").select("id").eq("requested_by", userId),
    ]);
    const ids = [...new Set([
      ...(memberRes.data ?? []).map((r: any) => r.project_id),
      ...(requestedRes.data ?? []).map((r: any) => r.id),
    ])].filter(Boolean);

    if (!ids.length) { setThreads([]); setLoading(false); return; }

    const { data: msgs } = await supabase.from("pm_portal_messages")
      .select("id, project_id, author_name, body, created_at")
      .in("project_id", ids).order("created_at", { ascending: false });

    const byProject = new Map<string, any[]>();
    for (const m of msgs ?? []) {
      const arr = byProject.get(m.project_id) ?? [];
      arr.push(m);
      byProject.set(m.project_id, arr);
    }
    if (!byProject.size) { setThreads([]); setLoading(false); return; }

    const projIds = [...byProject.keys()];
    const { data: projs } = await supabase.from("pm_projects").select("id, title, client_id").in("id", projIds);
    const clientIds = [...new Set((projs ?? []).map((p: any) => p.client_id).filter(Boolean))];
    const clientNames = new Map<string, string>();
    if (clientIds.length) {
      const { data: cs } = await supabase.from("clients").select("id, name").in("id", clientIds);
      for (const c of cs ?? []) clientNames.set(c.id, c.name);
    }

    const summaries: MessageThreadSummary[] = (projs ?? []).map((p: any) => {
      const list = byProject.get(p.id) ?? [];
      const last = list[0];
      let watermark = "";
      try { watermark = localStorage.getItem(portalReadKey(userId, p.id)) ?? ""; } catch { /* ignore */ }
      const unread = watermark ? list.filter(m => m.created_at > watermark).length : list.length;
      return {
        projectId: p.id,
        projectTitle: p.title,
        clientName: p.client_id ? clientNames.get(p.client_id) ?? null : null,
        lastBody: last?.body ?? "",
        lastAuthor: last?.author_name ?? "",
        lastAt: last?.created_at ?? "",
        unread,
      };
    }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));

    setThreads(summaries);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  return { threads, loading, reload: load };
}

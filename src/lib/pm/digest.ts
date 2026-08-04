/**
 * "Since you last checked" activity digest (read-only).
 *
 * Watermark is stored in localStorage as `lastVisit_<userId>`; on mount we read
 * the previous value (fallback: 24h ago) and immediately stamp "now" so the next
 * visit picks up where this one ended. This is a purely informational digest —
 * it never touches the notification bell or notification preferences.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllResume } from "@/lib/pm/activity";

export type DigestFilter = "all" | "mentions" | "due" | "blocked" | "files";

export const DIGEST_FILTERS: { id: DigestFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "due", label: "Due changes" },
  { id: "blocked", label: "Blocked / Unblocked" },
  { id: "files", label: "Files & Comments" },
];

export interface DigestEvent {
  id: string;
  at: string;                 // ISO
  actorId: string | null;
  verb: string;               // "changed the status of", "commented on", …
  objectLabel: string;        // task title / file name / project title
  objectHref: string | null;  // link to the object
  projectId: string | null;
  categories: DigestFilter[]; // which filter pills this event belongs to
  detail?: string;            // optional trailing detail ("blocked → in progress")
}

const KEY = (userId: string) => `lastVisit_${userId}`;
const DAY = 24 * 60 * 60 * 1000;

export function readWatermark(userId: string): number {
  try {
    const raw = window.localStorage.getItem(KEY(userId));
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  } catch { /* ignore */ }
  return Date.now() - DAY;
}

export function stampWatermark(userId: string, at = Date.now()) {
  try { window.localStorage.setItem(KEY(userId), String(at)); } catch { /* ignore */ }
}

/** Relative "3h ago" label for an ISO timestamp. */
export function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function verbForAction(action: string, payload: any): { verb: string; categories: DigestFilter[]; detail?: string } {
  switch (action) {
    case "task.status_changed": {
      const to = payload?.to ?? payload?.status;
      const from = payload?.from;
      const blocked = to === "blocked" || from === "blocked";
      return {
        verb: blocked && to === "blocked" ? "blocked" : blocked ? "unblocked" : "changed the status of",
        categories: blocked ? ["blocked"] : [],
        detail: from && to ? `${from} → ${to}` : to ? String(to) : undefined,
      };
    }
    case "task.dates_cascaded":
      return { verb: "shifted dates on", categories: ["due"] };
    case "task.updated": {
      const keys: string[] = Object.keys(payload?.changes ?? payload ?? {});
      const dueChanged = keys.some(k => k === "due_date" || k === "start_date");
      return { verb: "updated", categories: dueChanged ? ["due"] : [] };
    }
    case "project.go_live_changed":
      return { verb: "changed the go-live date on", categories: ["due"] };
    case "task.claimed":
      return { verb: "claimed", categories: [] };
    case "task.declined":
      return { verb: "declined", categories: [] };
    case "task.decline_reverted":
      return { verb: "restored", categories: [] };
    case "project.converted_to_project":
      return { verb: "converted to a project", categories: [] };
    default:
      return { verb: action.replace(/^.*\./, "").replace(/_/g, " "), categories: [] };
  }
}

export interface DigestData {
  events: DigestEvent[];
  projectNames: Map<string, string>;
  clientNames: Map<string, string>;
  since: number;
  loading: boolean;
  markSeen: () => void;
}

export function useActivityDigest(userId: string | null | undefined): DigestData {
  const [since, setSince] = useState<number>(() => (userId ? readWatermark(userId) : Date.now() - DAY));
  const [events, setEvents] = useState<DigestEvent[]>([]);
  const [projectNames, setProjectNames] = useState<Map<string, string>>(new Map());
  const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Read the old watermark, then stamp "now" so the next visit continues cleanly.
  useEffect(() => {
    if (!userId) return;
    setSince(readWatermark(userId));
    stampWatermark(userId);
  }, [userId]);

  const load = useCallback(async (sinceMs: number) => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const sinceIso = new Date(sinceMs).toISOString();

    // --- Scope: projects the user is connected to ---
    const [{ data: memberRows }, { data: myTasks }] = await Promise.all([
      supabase.from("pm_project_members").select("project_id").eq("user_id", userId),
      supabase.from("pm_tasks").select("project_id").eq("assignee_id", userId),
    ]);
    const scope = new Set<string>();
    (memberRows ?? []).forEach((r: any) => r.project_id && scope.add(r.project_id));
    (myTasks ?? []).forEach((r: any) => r.project_id && scope.add(r.project_id));
    Object.keys(getAllResume(userId)).forEach(pid => scope.add(pid));
    const scopeIds = [...scope];

    if (!scopeIds.length) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const [{ data: logs }, { data: comments }, { data: files }] = await Promise.all([
      supabase.from("pm_activity_log").select("*")
        .gte("created_at", sinceIso).in("project_id", scopeIds)
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("pm_comments").select("id,body,created_at,user_id,task_id,project_id,mentions")
        .gte("created_at", sinceIso).in("project_id", scopeIds)
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("pm_project_attachments").select("id,name,created_at,uploaded_by,project_id")
        .gte("created_at", sinceIso).in("project_id", scopeIds)
        .order("created_at", { ascending: false }).limit(50),
    ]);

    // Resolve task titles referenced by the events.
    const taskIds = new Set<string>();
    (logs ?? []).forEach((l: any) => l.task_id && taskIds.add(l.task_id));
    (comments ?? []).forEach((c: any) => c.task_id && taskIds.add(c.task_id));
    const [{ data: taskRows }, { data: projRows }, { data: clientRows }] = await Promise.all([
      taskIds.size
        ? supabase.from("pm_tasks").select("id,title").in("id", [...taskIds])
        : Promise.resolve({ data: [] as any[] } as any),
      supabase.from("pm_projects").select("id,title,client_id").in("id", scopeIds),
      supabase.from("clients").select("id,name"),
    ]);
    const taskTitles = new Map<string, string>(((taskRows as any[]) ?? []).map(t => [t.id, t.title]));
    const projMap = new Map<string, string>(((projRows as any[]) ?? []).map(p => [p.id, p.title]));
    const projClient = new Map<string, string | null>(((projRows as any[]) ?? []).map(p => [p.id, p.client_id]));
    const clientMap = new Map<string, string>(((clientRows as any[]) ?? []).map(c => [c.id, c.name]));

    const out: DigestEvent[] = [];

    for (const l of (logs as any[]) ?? []) {
      if (l.user_id === userId) continue; // your own actions aren't news
      const { verb, categories, detail } = verbForAction(l.action, l.payload);
      const label = l.task_id
        ? taskTitles.get(l.task_id) ?? l.payload?.title ?? "a task"
        : projMap.get(l.project_id) ?? "the project";
      out.push({
        id: `log-${l.id}`,
        at: l.created_at,
        actorId: l.user_id,
        verb,
        objectLabel: label,
        objectHref: l.task_id ? `/pm/tasks/${l.task_id}` : l.project_id ? `/pm/projects/${l.project_id}` : null,
        projectId: l.project_id,
        categories,
        detail,
      });
    }

    for (const c of (comments as any[]) ?? []) {
      if (c.user_id === userId) continue;
      const mentioned = Array.isArray(c.mentions) && c.mentions.includes(userId);
      out.push({
        id: `comment-${c.id}`,
        at: c.created_at,
        actorId: c.user_id,
        verb: mentioned ? "mentioned you on" : "commented on",
        objectLabel: c.task_id ? taskTitles.get(c.task_id) ?? "a task" : projMap.get(c.project_id) ?? "the project",
        objectHref: c.task_id ? `/pm/tasks/${c.task_id}` : c.project_id ? `/pm/projects/${c.project_id}` : null,
        projectId: c.project_id,
        categories: mentioned ? ["mentions", "files"] : ["files"],
        detail: (c.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || undefined,
      });
    }

    for (const f of (files as any[]) ?? []) {
      if (f.uploaded_by === userId) continue;
      out.push({
        id: `file-${f.id}`,
        at: f.created_at,
        actorId: f.uploaded_by,
        verb: "added a file to",
        objectLabel: projMap.get(f.project_id) ?? "the project",
        objectHref: `/pm/projects/${f.project_id}?tab=files`,
        projectId: f.project_id,
        categories: ["files"],
        detail: f.name,
      });
    }

    out.sort((a, b) => b.at.localeCompare(a.at));
    setEvents(out);
    setProjectNames(projMap);
    setClientNames(new Map([...projClient].flatMap(([pid, cid]) =>
      cid && clientMap.get(cid) ? [[pid, clientMap.get(cid)!] as [string, string]] : []
    )));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(since); }, [load, since]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    const now = Date.now();
    stampWatermark(userId, now);
    setSince(now);
  }, [userId]);

  return useMemo(
    () => ({ events, projectNames, clientNames, since, loading, markSeen }),
    [events, projectNames, clientNames, since, loading, markSeen],
  );
}

/** Group events by project, preserving recency order of both groups and rows. */
export function groupByProject(events: DigestEvent[]): { projectId: string | null; events: DigestEvent[] }[] {
  const order: (string | null)[] = [];
  const map = new Map<string | null, DigestEvent[]>();
  for (const e of events) {
    if (!map.has(e.projectId)) { map.set(e.projectId, []); order.push(e.projectId); }
    map.get(e.projectId)!.push(e);
  }
  return order.map(pid => ({ projectId: pid, events: map.get(pid)! }));
}

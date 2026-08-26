import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import { localDateISO } from "@/lib/pm/format";
import { isDone, type TaskStatus } from "@/types/pm";

export type NotifEventType =
  | "assigned"
  | "unassigned"
  | "mention"
  | "status_change"
  | "due_soon"
  | "overdue"
  | "new_request"
  | "unclaimed_team";

export const EVENT_META: Record<NotifEventType, { label: string; desc: string; urgent: boolean }> = {
  assigned:       { label: "Assigned to a task",       desc: "You were made the owner or co-assignee of a task", urgent: true },
  unassigned:     { label: "Removed from a task",      desc: "You were removed as an assignee on a task", urgent: true },
  mention:        { label: "@Mentions",                desc: "Someone mentioned you in a comment or notes", urgent: true },
  status_change:  { label: "Status changes",           desc: "Status changed on a task you're assigned to", urgent: false },
  due_soon:       { label: "Due soon",                 desc: "A task you're assigned to is due within 24 hours", urgent: false },
  overdue:        { label: "Overdue",                  desc: "A task you're assigned to is past its due date", urgent: true },
  new_request:    { label: "New request submitted",    desc: "Creative/production quick requests (web, career site, design, dev). Other requests appear on the Daily Briefing dashboard only.", urgent: false },
  unclaimed_team: { label: "Unclaimed work in my team", desc: "Legacy — no longer broadcast. Unclaimed requests appear on the Daily Briefing dashboard.", urgent: false },
};

export const ALL_EVENT_TYPES = Object.keys(EVENT_META) as NotifEventType[];

const OFF_BY_DEFAULT: NotifEventType[] = ["new_request", "unclaimed_team"];

export function defaultPrefFor(event_type: NotifEventType): NotifPref {
  const on = !OFF_BY_DEFAULT.includes(event_type);
  return { event_type, in_app: on, email: on };
}

// ---- pub/sub for in-app refresh ----
const subs = new Set<() => void>();
export const emitNotificationsChanged = () => subs.forEach(fn => fn());

export interface PmNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface NotifPref {
  event_type: NotifEventType;
  in_app: boolean;
  email: boolean;
}

async function loadPrefs(userId: string): Promise<Record<NotifEventType, NotifPref>> {
  const { data } = await supabase
    .from("pm_notification_prefs")
    .select("event_type, in_app, email")
    .eq("user_id", userId);
  const map = {} as Record<NotifEventType, NotifPref>;
  for (const et of ALL_EVENT_TYPES) {
    map[et] = defaultPrefFor(et);
  }
  (data ?? []).forEach((row: any) => {
    if (ALL_EVENT_TYPES.includes(row.event_type)) {
      map[row.event_type as NotifEventType] = {
        event_type: row.event_type,
        in_app: row.in_app,
        email: row.email,
      };
    }
  });
  return map;
}

export function usePrefs() {
  const userId = getCurrentUserId();
  const [prefs, setPrefs] = useState<Record<NotifEventType, NotifPref> | null>(null);
  const reload = useCallback(async () => {
    if (!userId) return;
    setPrefs(await loadPrefs(userId));
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  const save = useCallback(async (event_type: NotifEventType, patch: Partial<Omit<NotifPref, "event_type">>) => {
    if (!userId) return;
    const curr = prefs?.[event_type] ?? defaultPrefFor(event_type);
    const next = { ...curr, ...patch };
    setPrefs(p => p ? { ...p, [event_type]: next } : p);
    await supabase.from("pm_notification_prefs").upsert(
      { user_id: userId, event_type, in_app: next.in_app, email: next.email },
      { onConflict: "user_id,event_type" }
    );
  }, [userId, prefs]);
  return { prefs, save, reload };
}

export function useRequestGroupSubs() {
  const userId = getCurrentUserId();
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const reload = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("pm_new_request_subs" as any)
      .select("group_key")
      .eq("user_id", userId);
    setKeys(new Set(((data ?? []) as { group_key: string }[]).map(r => r.group_key)));
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  const setGroup = useCallback(async (group_key: string, on: boolean) => {
    if (!userId) return;
    setKeys(prev => {
      const next = new Set(prev);
      if (on) next.add(group_key); else next.delete(group_key);
      return next;
    });
    if (on) {
      await supabase.from("pm_new_request_subs" as any).upsert(
        { user_id: userId, group_key },
        { onConflict: "user_id,group_key" },
      );
    } else {
      await supabase.from("pm_new_request_subs" as any).delete()
        .eq("user_id", userId).eq("group_key", group_key);
    }
  }, [userId]);
  return { keys, setGroup, reload };
}

/** Insert a notification for a user, respecting their prefs. */
export async function createNotification(params: {
  user_id: string;
  event_type: NotifEventType;
  title: string;
  body?: string;
  link?: string;
}) {
  if (!params.user_id) return;
  // Check prefs (default in_app on)
  const { data: pref } = await supabase
    .from("pm_notification_prefs")
    .select("in_app, email")
    .eq("user_id", params.user_id)
    .eq("event_type", params.event_type)
    .maybeSingle();
  const defaults = defaultPrefFor(params.event_type);
  const inApp = pref?.in_app ?? defaults.in_app;
  const email = pref?.email ?? defaults.email;
  // Insert when either channel is on so the email queue can claim the row.
  if (!inApp && !email) return;
  await supabase.from("pm_notifications").insert({
    user_id: params.user_id,
    type: params.event_type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
  if (inApp) emitNotificationsChanged();
}

export function extractMentionIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const re = /data-mention-id=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ids.add(m[1]);
  return [...ids];
}

/** Notify people newly @mentioned in rich text. Best-effort. */
export async function notifyNewMentions(params: {
  prevHtml?: string | null;
  nextHtml: string;
  title: string;
  body?: string;
  link: string;
}) {
  const actor = getCurrentUserId();
  const prev = new Set(extractMentionIds(params.prevHtml));
  const next = extractMentionIds(params.nextHtml).filter(id => id !== actor && !prev.has(id));
  for (const uid of next) {
    await createNotification({
      user_id: uid,
      event_type: "mention",
      title: params.title,
      body: params.body,
      link: params.link,
    });
  }
}

export async function notifyTaskAssigneeChange(params: {
  user_id: string;
  event_type: "assigned" | "unassigned";
  taskId: string;
  taskTitle?: string;
}) {
  const actor = getCurrentUserId();
  if (!params.user_id || params.user_id === actor) return;
  let title = params.taskTitle;
  if (!title) {
    const { data } = await supabase.from("pm_tasks").select("title").eq("id", params.taskId).maybeSingle();
    title = (data as any)?.title ?? "a task";
  }
  await createNotification({
    user_id: params.user_id,
    event_type: params.event_type,
    title: params.event_type === "assigned" ? `Assigned: ${title}` : `Removed: ${title}`,
    body: params.event_type === "assigned" ? "You were assigned to a task" : "You were removed from a task",
    link: `/pm/tasks/${params.taskId}`,
  });
}

// ---- data hooks ----
export function useMyNotifications(limit = 25) {
  const userId = getCurrentUserId();
  const [items, setItems] = useState<PmNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("pm_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data ?? []) as PmNotification[]);
    setLoading(false);
  }, [userId, limit]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const fn = () => reload();
    subs.add(fn);
    const int = setInterval(reload, 30000);
    return () => { subs.delete(fn); clearInterval(int); };
  }, [reload]);
  return { items, loading, reload };
}

export async function markNotificationRead(id: string) {
  await supabase.from("pm_notifications").update({ read: true }).eq("id", id);
  emitNotificationsChanged();
}

export async function markAllRead() {
  const userId = getCurrentUserId();
  if (!userId) return;
  await supabase.from("pm_notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  emitNotificationsChanged();
}

async function fetchAssignedTasks(userId: string) {
  const [{ data: primary }, { data: coRows }] = await Promise.all([
    supabase
      .from("pm_tasks")
      .select("id, title, due_date, status, assignee_id")
      .eq("assignee_id", userId)
      .not("due_date", "is", null),
    supabase.from("pm_task_assignees").select("task_id").eq("user_id", userId),
  ]);
  const coIds = ((coRows ?? []) as { task_id: string }[]).map(r => r.task_id);
  let coTasks: any[] = [];
  if (coIds.length) {
    const { data } = await supabase
      .from("pm_tasks")
      .select("id, title, due_date, status, assignee_id")
      .in("id", coIds)
      .not("due_date", "is", null);
    coTasks = (data ?? []) as any[];
  }
  const byId = new Map<string, any>();
  for (const t of (primary ?? []) as any[]) byId.set(t.id, t);
  for (const t of coTasks) byId.set(t.id, t);
  return [...byId.values()];
}

/** Scan tasks assigned to the current user and create due_soon / overdue notifications (dedup per day). */
export async function scanDueDateNotifications() {
  const userId = getCurrentUserId();
  if (!userId) return;
  const now = new Date();
  const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await fetchAssignedTasks(userId);
  if (!tasks.length) return;
  const today = localDateISO(now);
  // Fetch today's existing notifs to dedup
  const { data: existing } = await supabase
    .from("pm_notifications")
    .select("type, link, created_at")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00Z`);
  const seen = new Set((existing ?? []).map((n: any) => `${n.type}|${n.link}`));

  for (const t of tasks as any[]) {
    if (isDone(t.status as TaskStatus)) continue;
    const due = new Date(t.due_date);
    const link = `/pm/tasks/${t.id}`;
    if (due < now) {
      const key = `overdue|${link}`;
      if (!seen.has(key)) {
        await createNotification({
          user_id: userId, event_type: "overdue",
          title: `Overdue: ${t.title}`,
          body: `Was due ${due.toLocaleDateString()}`,
          link,
        });
      }
    } else if (due < in24) {
      const key = `due_soon|${link}`;
      if (!seen.has(key)) {
        await createNotification({
          user_id: userId, event_type: "due_soon",
          title: `Due soon: ${t.title}`,
          body: `Due ${due.toLocaleString()}`,
          link,
        });
      }
    }
  }
}

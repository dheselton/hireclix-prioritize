import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import { localDateISO } from "@/lib/pm/format";

export type NotifEventType =
  | "assigned"
  | "mention"
  | "status_change"
  | "due_soon"
  | "overdue"
  | "new_request"
  | "unclaimed_team";

export const EVENT_META: Record<NotifEventType, { label: string; desc: string; urgent: boolean }> = {
  assigned:       { label: "Assigned to a task",       desc: "You were made the owner or co-assignee of a task", urgent: true },
  mention:        { label: "@Mentions",                desc: "Someone mentioned you in a comment", urgent: true },
  status_change:  { label: "Status changes",           desc: "Status changed on a task you own", urgent: false },
  due_soon:       { label: "Due soon",                 desc: "A task you own is due within 24 hours", urgent: false },
  overdue:        { label: "Overdue",                  desc: "A task you own is past its due date", urgent: true },
  new_request:    { label: "New request submitted",    desc: "A new intake request has been created (PM/CSM)", urgent: false },
  unclaimed_team: { label: "Unclaimed work in my team", desc: "A new unclaimed task appeared in your team's queue", urgent: false },
};

export const ALL_EVENT_TYPES = Object.keys(EVENT_META) as NotifEventType[];

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
    map[et] = { event_type: et, in_app: true, email: true };
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
    const curr = prefs?.[event_type] ?? { event_type, in_app: true, email: true };
    const next = { ...curr, ...patch };
    setPrefs(p => p ? { ...p, [event_type]: next } : p);
    await supabase.from("pm_notification_prefs").upsert(
      { user_id: userId, event_type, in_app: next.in_app, email: next.email },
      { onConflict: "user_id,event_type" }
    );
  }, [userId, prefs]);
  return { prefs, save, reload };
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
  const inApp = pref?.in_app ?? true;
  if (!inApp) return;
  await supabase.from("pm_notifications").insert({
    user_id: params.user_id,
    type: params.event_type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
  emitNotificationsChanged();
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

/** Scan the current user's tasks and create due_soon / overdue notifications (dedup per day). */
export async function scanDueDateNotifications() {
  const userId = getCurrentUserId();
  if (!userId) return;
  const now = new Date();
  const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: tasks } = await supabase
    .from("pm_tasks")
    .select("id, title, due_date, status, assignee_id")
    .eq("assignee_id", userId)
    .not("due_date", "is", null);
  if (!tasks) return;
  const today = localDateISO(now);
  // Fetch today's existing notifs to dedup
  const { data: existing } = await supabase
    .from("pm_notifications")
    .select("type, link, created_at")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00Z`);
  const seen = new Set((existing ?? []).map((n: any) => `${n.type}|${n.link}`));

  for (const t of tasks as any[]) {
    if (["complete", "approved"].includes(t.status)) continue;
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

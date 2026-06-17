import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PmTask } from "@/types/pm";

export type PinnedTask = PmTask & { pin_id: string };

export async function fetchPinnedTasks(userId: string): Promise<PinnedTask[]> {
  const { data, error } = await supabase
    .from("pm_user_pinned_tasks")
    .select("id, sort_order, pm_tasks(*)")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; sort_order: number; pm_tasks: PmTask | null }>;
  return rows
    .filter(r => r.pm_tasks)
    .map(r => ({ ...(r.pm_tasks as PmTask), pin_id: r.id }));
}

export async function pinTask(userId: string, taskId: string) {
  await supabase
    .from("pm_user_pinned_tasks")
    .upsert({ user_id: userId, task_id: taskId }, { onConflict: "user_id,task_id" });
}

export async function unpinTask(userId: string, taskId: string) {
  await supabase
    .from("pm_user_pinned_tasks")
    .delete()
    .match({ user_id: userId, task_id: taskId });
}

export async function isTaskPinned(userId: string, taskId: string): Promise<boolean> {
  const { data } = await supabase
    .from("pm_user_pinned_tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();
  return !!data;
}

export function usePinnedTasks(userId?: string | null) {
  const [tasks, setTasks] = useState<PinnedTask[]>([]);
  const reload = useCallback(async () => {
    if (!userId) { setTasks([]); return; }
    try { setTasks(await fetchPinnedTasks(userId)); } catch { setTasks([]); }
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  return { tasks, reload };
}

export function useIsTaskPinned(userId?: string | null, taskId?: string | null) {
  const [pinned, setPinned] = useState(false);
  const reload = useCallback(async () => {
    if (!userId || !taskId) { setPinned(false); return; }
    setPinned(await isTaskPinned(userId, taskId));
  }, [userId, taskId]);
  useEffect(() => { reload(); }, [reload]);
  return { pinned, reload, setPinned };
}

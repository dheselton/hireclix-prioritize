/**
 * Per-task tracked-time totals.
 *
 * Cards across the app show "how much time has gone into this task" — instead of
 * one query per card we load the whole task→minutes map once and cache it with
 * react-query, refreshing whenever a time entry changes.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTimeChanged } from "@/lib/pm/time";

export const TASK_TIME_TOTALS_KEY = ["pm", "task-time-totals"] as const;

export async function fetchTaskTimeTotals(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("pm_time_entries")
    .select("task_id, minutes")
    .not("task_id", "is", null);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of (data || []) as { task_id: string | null; minutes: number }[]) {
    if (!r.task_id) continue;
    map.set(r.task_id, (map.get(r.task_id) ?? 0) + (r.minutes || 0));
  }
  return map;
}

/** Map of task_id → total minutes logged. Cached app-wide. */
export function useTaskTimeTotals() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: TASK_TIME_TOTALS_KEY,
    queryFn: fetchTaskTimeTotals,
    staleTime: 60_000,
  });
  useTimeChanged(() => { qc.invalidateQueries({ queryKey: TASK_TIME_TOTALS_KEY }); });
  useEffect(() => {}, []);
  return data ?? new Map<string, number>();
}

/** Minutes logged on a single task (0 when none / still loading). */
export function useTaskTimeTotal(taskId: string | null | undefined) {
  const totals = useTaskTimeTotals();
  return taskId ? (totals.get(taskId) ?? 0) : 0;
}

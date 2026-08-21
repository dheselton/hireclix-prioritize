/**
 * Project-level tracked-time totals.
 *
 * Sums pm_time_entries.minutes for every task (including subtasks) in a project.
 * Overhead activity entries (activity_id set, no task_id) are excluded.
 * Running timers are not included until stopped into pm_time_entries.
 *
 * Visibility: RLS lets PM/BA see all entries; others only see their own.
 * Callers should gate the all-team total with canSeeProjectTimeTotal().
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTimeChanged } from "@/lib/pm/time";
import { toRoles, type RoleOrRoles } from "@/lib/pm/permissions";

export const PROJECT_TIME_TOTAL_KEY = (projectId: string) =>
  ["pm", "project-time-total", projectId] as const;

/** True when the viewer may see the all-team project time total. */
export function canSeeProjectTimeTotal(role: RoleOrRoles): boolean {
  return toRoles(role).some((r) => r === "pm" || r === "ba");
}

export async function fetchProjectTimeTotal(projectId: string): Promise<number> {
  if (!projectId) return 0;
  const { data: tasks, error: taskErr } = await supabase
    .from("pm_tasks")
    .select("id")
    .eq("project_id", projectId);
  if (taskErr) throw taskErr;
  const taskIds = ((tasks as { id: string }[]) ?? []).map((t) => t.id);
  if (!taskIds.length) return 0;

  // Chunk to stay under PostgREST URL limits for large projects.
  const CHUNK = 200;
  let total = 0;
  for (let i = 0; i < taskIds.length; i += CHUNK) {
    const slice = taskIds.slice(i, i + CHUNK);
    const { data: entries, error } = await supabase
      .from("pm_time_entries")
      .select("minutes")
      .in("task_id", slice);
    if (error) throw error;
    for (const e of (entries as { minutes: number }[]) ?? []) {
      total += e.minutes || 0;
    }
  }
  return total;
}

/** All-time minutes logged across every task in the project (0 while loading). */
export function useProjectTimeTotal(projectId: string | null | undefined) {
  const qc = useQueryClient();
  const key = PROJECT_TIME_TOTAL_KEY(projectId ?? "");
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchProjectTimeTotal(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
  useTimeChanged(() => {
    if (projectId) qc.invalidateQueries({ queryKey: key });
  });
  return data ?? 0;
}

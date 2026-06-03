import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = ["pm_task_assignees_map"] as const;

/** Map of task_id -> co-assignee user_ids (excludes the primary owner). */
export function useTaskAssigneesMap() {
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("pm_task_assignees")
        .select("task_id, user_id");
      const map = new Map<string, string[]>();
      for (const r of (data ?? []) as Array<{ task_id: string; user_id: string }>) {
        const arr = map.get(r.task_id) ?? [];
        if (!arr.includes(r.user_id)) arr.push(r.user_id);
        map.set(r.task_id, arr);
      }
      return map;
    },
    staleTime: 15_000,
  });
  return data ?? new Map<string, string[]>();
}

/** Co-assignees for a single task. */
export function useTaskCoAssignees(taskId?: string | null): string[] {
  const map = useTaskAssigneesMap();
  if (!taskId) return [];
  return map.get(taskId) ?? [];
}

/** Combined ordered list: primary first, then co-assignees. */
export function combineAssignees(primary: string | null | undefined, co: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (primary) { out.push(primary); seen.add(primary); }
  for (const id of co) if (id && !seen.has(id)) { out.push(id); seen.add(id); }
  return out;
}

export function useInvalidateAssignees() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

async function fetchCo(taskId: string): Promise<string[]> {
  const { data } = await supabase
    .from("pm_task_assignees").select("user_id").eq("task_id", taskId);
  return ((data ?? []) as Array<{ user_id: string }>).map(r => r.user_id);
}

async function fetchPrimary(taskId: string): Promise<string | null> {
  const { data } = await supabase
    .from("pm_tasks").select("assignee_id").eq("id", taskId).maybeSingle();
  return (data as any)?.assignee_id ?? null;
}

/** Add a co-assignee (no-op if already primary or already co). */
export async function addAssignee(taskId: string, userId: string) {
  const primary = await fetchPrimary(taskId);
  if (primary === userId) return;
  if (!primary) {
    // No primary yet → promote this user to primary
    await supabase.from("pm_tasks").update({ assignee_id: userId }).eq("id", taskId);
    // Make sure they aren't also in the co table
    await supabase.from("pm_task_assignees").delete().match({ task_id: taskId, user_id: userId });
    return;
  }
  await supabase
    .from("pm_task_assignees")
    .upsert({ task_id: taskId, user_id: userId }, { onConflict: "task_id,user_id" });
}

/** Remove an assignee. If removing the primary, promote oldest co-assignee. */
export async function removeAssignee(taskId: string, userId: string) {
  const primary = await fetchPrimary(taskId);
  if (primary === userId) {
    const co = await fetchCo(taskId);
    const next = co[0] ?? null;
    await supabase.from("pm_tasks").update({ assignee_id: next }).eq("id", taskId);
    if (next) {
      await supabase.from("pm_task_assignees").delete().match({ task_id: taskId, user_id: next });
    }
  } else {
    await supabase.from("pm_task_assignees").delete().match({ task_id: taskId, user_id: userId });
  }
}

/** Make `userId` the primary owner; demote previous primary into co-assignees. */
export async function setPrimaryAssignee(taskId: string, userId: string) {
  const primary = await fetchPrimary(taskId);
  if (primary === userId) return;
  await supabase.from("pm_tasks").update({ assignee_id: userId }).eq("id", taskId);
  // Remove userId from co (now primary)
  await supabase.from("pm_task_assignees").delete().match({ task_id: taskId, user_id: userId });
  // Demote previous primary into co
  if (primary) {
    await supabase
      .from("pm_task_assignees")
      .upsert({ task_id: taskId, user_id: primary }, { onConflict: "task_id,user_id" });
  }
}

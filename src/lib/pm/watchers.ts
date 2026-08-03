import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- Project-level watching ---------------- */

/** All project IDs where userId is on the project (member or explicit watcher). */
export async function fetchWatchedProjectIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("pm_project_members")
    .select("project_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r: any) => r.project_id));
}

/** Members are watching by default — any row on the project counts. */
export async function isWatchingProject(userId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("pm_project_members")
    .select("project_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  return !!data;
}

export async function watchProject(userId: string, projectId: string) {
  // The unique constraint on pm_project_members is (project_id, user_id).
  // If a row already exists for this user/project (any role), they're already
  // on the project — report the existing role so callers can explain that.
  const { data: existing } = await supabase
    .from("pm_project_members")
    .select("id,role")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) {
    return {
      ok: true as const,
      existed: true,
      existingRole: (existing as any).role as string | null,
    };
  }

  const { error } = await supabase
    .from("pm_project_members")
    .insert({ user_id: userId, project_id: projectId, role: "watcher" } as any);
  if (error) return { ok: false as const, error, existed: false, existingRole: null };
  return { ok: true as const, existed: false, existingRole: null };
}

export async function unwatchProject(userId: string, projectId: string) {
  const { data, error } = await supabase.from("pm_project_members")
    .delete()
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("role", "watcher")
    .select("id");
  // No watcher row removed => they're still on the project as a real member.
  const stillMember = !error && (data ?? []).length === 0;
  return { ok: !error, error, stillMember };
}


export function useIsWatchingProject(userId: string | null | undefined, projectId: string | null | undefined) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!userId || !projectId) { setWatching(false); setLoading(false); return; }
    setLoading(true);
    setWatching(await isWatchingProject(userId, projectId));
    setLoading(false);
  }, [userId, projectId]);
  useEffect(() => { reload(); }, [reload]);
  return { watching, setWatching, loading, reload };
}

/* ---------------- Task-level watching ---------------- */

export async function fetchWatchedTaskIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("pm_task_watchers" as any)
    .select("task_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r: any) => r.task_id));
}

export async function isWatchingTask(userId: string, taskId: string): Promise<boolean> {
  const { data } = await supabase
    .from("pm_task_watchers" as any)
    .select("task_id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();
  return !!data;
}

export async function watchTask(userId: string, taskId: string) {
  const { error } = await supabase
    .from("pm_task_watchers" as any)
    .upsert({ user_id: userId, task_id: taskId } as any, { onConflict: "task_id,user_id" });
  return { ok: !error, error };
}

export async function unwatchTask(userId: string, taskId: string) {
  const { error } = await supabase
    .from("pm_task_watchers" as any)
    .delete()
    .eq("user_id", userId)
    .eq("task_id", taskId);
  return { ok: !error, error };
}

export function useIsWatchingTask(userId: string | null | undefined, taskId: string | null | undefined) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!userId || !taskId) { setWatching(false); setLoading(false); return; }
    setLoading(true);
    setWatching(await isWatchingTask(userId, taskId));
    setLoading(false);
  }, [userId, taskId]);
  useEffect(() => { reload(); }, [reload]);
  return { watching, setWatching, loading, reload };
}

/* ---------------- Union view for filters ---------------- */

/**
 * Union of:
 *  - Tasks explicitly watched by this user (pm_task_watchers)
 *  - Tasks whose project is watched by this user (pm_project_members role='watcher')
 */
export function useWatchedTaskIds(
  userId: string | null | undefined,
  tasks: { id: string; project_id: string | null }[],
) {
  const [projectSet, setProjectSet] = useState<Set<string>>(new Set());
  const [taskSet, setTaskSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) { setProjectSet(new Set()); setTaskSet(new Set()); return; }
      const [projs, tsks] = await Promise.all([
        fetchWatchedProjectIds(userId),
        fetchWatchedTaskIds(userId),
      ]);
      if (!alive) return;
      setProjectSet(projs);
      setTaskSet(tsks);
    })();
    return () => { alive = false; };
  }, [userId]);

  return useMemo(() => {
    const out = new Set<string>(taskSet);
    for (const t of tasks) if (t.project_id && projectSet.has(t.project_id)) out.add(t.id);
    return out;
  }, [tasks, projectSet, taskSet]);
}

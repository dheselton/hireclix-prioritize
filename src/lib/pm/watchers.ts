import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/** All project IDs where userId is a member (any role) — used to compute watched tasks. */
export async function fetchWatchedProjectIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("pm_project_members")
    .select("project_id")
    .eq("user_id", userId)
    .eq("role", "watcher");
  return new Set((data ?? []).map((r: any) => r.project_id));
}

export async function isWatchingProject(userId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("pm_project_members")
    .select("project_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("role", "watcher")
    .maybeSingle();
  return !!data;
}

export async function watchProject(userId: string, projectId: string) {
  await supabase.from("pm_project_members").upsert(
    { user_id: userId, project_id: projectId, role: "watcher" } as any,
    { onConflict: "project_id,user_id,role" }
  );
}

export async function unwatchProject(userId: string, projectId: string) {
  await supabase.from("pm_project_members")
    .delete()
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("role", "watcher");
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

/** Compute set of tasks the user is "watching" via project membership. */
export function useWatchedTaskIds(userId: string | null | undefined, tasks: { id: string; project_id: string | null }[]) {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) { setSet(new Set()); return; }
      const projs = await fetchWatchedProjectIds(userId);
      if (!alive) return;
      const ids = new Set<string>();
      for (const t of tasks) if (t.project_id && projs.has(t.project_id)) ids.add(t.id);
      setSet(ids);
    })();
    return () => { alive = false; };
  }, [userId, tasks]);
  return set;
}

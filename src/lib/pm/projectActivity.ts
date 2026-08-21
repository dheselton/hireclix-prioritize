/**
 * Recent activity for a single project overview.
 * Lightweight read of pm_activity_log — same source as Report / digest.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectActivityRow {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  task_id: string | null;
  payload: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  "project.go_live_changed": "updated go-live",
  "task.dates_cascaded": "cascaded task dates",
  "task.created": "created a task",
  "task.completed": "completed a task",
  "task.status_changed": "changed a task status",
  "comment.added": "added a comment",
  "attachment.added": "added a file",
};

export function labelProjectActivity(action: string, payload?: Record<string, unknown> | null): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const title = typeof payload?.title === "string" ? payload.title : null;
  const short = action.replace(/^[\w]+\./, "").replace(/_/g, " ");
  return title ? `${short}: ${title}` : short;
}

export async function fetchProjectActivity(
  projectId: string,
  limit = 8,
): Promise<ProjectActivityRow[]> {
  const { data, error } = await supabase
    .from("pm_activity_log")
    .select("id, action, created_at, user_id, task_id, payload")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as any[]) || []).map((r) => ({
    id: r.id,
    action: r.action,
    created_at: r.created_at,
    user_id: r.user_id ?? null,
    task_id: r.task_id ?? null,
    payload: (r.payload as Record<string, unknown>) ?? null,
  }));
}

export function useProjectActivity(projectId: string | null | undefined, limit = 8) {
  const [events, setEvents] = useState<ProjectActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEvents(await fetchProjectActivity(projectId, limit));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { events, loading, reload };
}

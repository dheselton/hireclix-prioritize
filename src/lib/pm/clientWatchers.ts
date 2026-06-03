import { supabase } from "@/integrations/supabase/client";

/**
 * Returns deduped userIds configured as watchers for this client. If
 * `requestType` is provided, also includes watchers scoped to that
 * specific request type. Rows with `request_type IS NULL` apply to all
 * request types for the client.
 */
export async function fetchClientWatchers(
  clientId: string | null | undefined,
  requestType?: string | null,
): Promise<string[]> {
  if (!clientId) return [];
  let q = supabase
    .from("pm_client_watchers")
    .select("user_id, request_type")
    .eq("client_id", clientId);
  const { data, error } = await q;
  if (error || !data) return [];
  const ids = new Set<string>();
  for (const row of data as Array<{ user_id: string; request_type: string | null }>) {
    if (row.request_type == null || row.request_type === requestType) {
      ids.add(row.user_id);
    }
  }
  return [...ids];
}

/**
 * Adds matching watchers as `pm_project_members` with role='watcher'.
 * Idempotent — uses upsert on (project_id, user_id). Returns the watcher
 * userIds that matched so the caller can show them on the confirmation
 * screen.
 */
export async function applyClientWatchers(
  projectId: string,
  clientId: string | null | undefined,
  requestType?: string | null,
): Promise<string[]> {
  const ids = await fetchClientWatchers(clientId, requestType);
  if (!ids.length) return [];
  const rows = ids.map((user_id) => ({ project_id: projectId, user_id, role: "watcher" }));
  await supabase
    .from("pm_project_members")
    .upsert(rows as any, { onConflict: "project_id,user_id", ignoreDuplicates: true });
  return ids;
}

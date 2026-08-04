/**
 * PORTAL-3 data layer: the shared client-facing message thread.
 *
 * One thread per project, stored in `pm_portal_messages`. Authors are either
 * an internal user (`author_user_id`) or a portal visitor (`author_portal_id`).
 * Attachments live in the private `portal-attachments` bucket; rows keep the
 * storage path and we mint short-lived signed URLs on demand.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyClientsOfUpdate } from "@/lib/pm/portalNotify";

export const PORTAL_BUCKET = "portal-attachments";

export interface PortalAttachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface PortalMessage {
  id: string;
  project_id: string;
  author_user_id: string | null;
  author_portal_id: string | null;
  author_name: string;
  body: string;
  attachments: PortalAttachment[];
  created_at: string;
}

function toMessage(row: any): PortalMessage {
  return {
    id: row.id,
    project_id: row.project_id,
    author_user_id: row.author_user_id ?? null,
    author_portal_id: row.author_portal_id ?? null,
    author_name: row.author_name ?? "Unknown",
    body: row.body ?? "",
    attachments: Array.isArray(row.attachments) ? (row.attachments as PortalAttachment[]) : [],
    created_at: row.created_at,
  };
}

export async function fetchPortalMessages(projectId: string): Promise<PortalMessage[]> {
  const { data, error } = await supabase
    .from("pm_portal_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toMessage);
}

/** Upload one file to the private portal bucket. Returns null on failure. */
export async function uploadPortalAttachment(projectId: string, file: File): Promise<PortalAttachment | null> {
  const path = `project/${projectId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from(PORTAL_BUCKET).upload(path, file);
  if (error) {
    console.error("portal attachment upload failed", file.name, error);
    return null;
  }
  return { name: file.name, path, size: file.size, type: file.type };
}

export async function signedPortalUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PORTAL_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) {
    console.error("signed url failed", path, error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function postPortalMessage(opts: {
  projectId: string;
  body: string;
  authorName: string;
  authorUserId?: string | null;
  authorPortalId?: string | null;
  attachments?: PortalAttachment[];
}): Promise<PortalMessage> {
  const { data, error } = await supabase
    .from("pm_portal_messages")
    .insert({
      project_id: opts.projectId,
      body: opts.body,
      author_name: opts.authorName,
      author_user_id: opts.authorUserId ?? null,
      author_portal_id: opts.authorPortalId ?? null,
      attachments: (opts.attachments ?? []) as any,
    } as any)
    .select("*")
    .single();
  if (error) throw error;

  // Team-authored posts email the client contacts; client-authored posts are
  // handled server-side by the portal-api function.
  if (opts.authorUserId) {
    void notifyClientsOfUpdate({
      projectId: opts.projectId,
      subject: `New message from ${opts.authorName}`,
      message: opts.body.slice(0, 1000),
    });
  }

  return toMessage(data);
}

/** Live thread state with realtime inserts. */
export function usePortalMessages(projectId: string | null) {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) { setMessages([]); setLoading(false); return; }
    setLoading(true); setFailed(false);
    try {
      setMessages(await fetchPortalMessages(projectId));
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`portal-messages-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_portal_messages", filter: `project_id=eq.${projectId}` },
        payload => {
          const msg = toMessage(payload.new);
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  return { messages, loading, failed, reload: load, setMessages };
}

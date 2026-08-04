/**
 * PORTAL-6: queue + deliver client portal emails.
 *
 * Everything is written to `pm_portal_notifications` first (so there's an
 * audit trail even if mail is down), then the `send-portal-email` edge
 * function is nudged to drain the queue. Nothing here ever throws — an email
 * failure must never break the action that triggered it.
 */
import { supabase } from "@/integrations/supabase/client";

export type PortalNotifKind =
  | "portal_invite"
  | "comment_added"
  | "status_changed"
  | "file_uploaded"
  | "request_completed"
  | "update_posted";

export interface PortalNotifRow {
  portal_access_id?: string | null;
  user_id?: string | null;
  kind: PortalNotifKind;
  project_id?: string | null;
  task_id?: string | null;
  subject?: string | null;
  message?: string | null;
}

/** Fire the mailer without blocking the caller. */
export function drainPortalEmails(): void {
  supabase.functions
    .invoke("send-portal-email", { body: {} })
    .then(({ error }) => { if (error) console.error("send-portal-email failed:", error); })
    .catch(e => console.error("send-portal-email failed:", e));
}

export async function queuePortalNotifications(rows: PortalNotifRow[]): Promise<void> {
  if (!rows.length) return;
  try {
    const { error } = await supabase.from("pm_portal_notifications").insert(rows as any);
    if (error) { console.error("queue portal notifications failed", error); return; }
    drainPortalEmails();
  } catch (e) {
    console.error("queue portal notifications failed", e);
  }
}

/** Active portal contacts for the client that owns a project. */
export async function portalContactsForProject(projectId: string): Promise<{ id: string }[]> {
  const { data: project } = await supabase
    .from("pm_projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.client_id) return [];
  const { data } = await supabase
    .from("pm_portal_access")
    .select("id")
    .eq("client_id", project.client_id)
    .eq("is_active", true);
  return (data ?? []) as { id: string }[];
}

/** Email every active client contact when the team posts an update. */
export async function notifyClientsOfUpdate(opts: {
  projectId: string;
  kind?: PortalNotifKind;
  subject: string;
  message: string;
}): Promise<void> {
  const contacts = await portalContactsForProject(opts.projectId).catch(() => []);
  await queuePortalNotifications(
    contacts.map(c => ({
      portal_access_id: c.id,
      kind: opts.kind ?? "update_posted",
      project_id: opts.projectId,
      subject: opts.subject,
      message: opts.message,
    })),
  );
}

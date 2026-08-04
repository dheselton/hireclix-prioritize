/**
 * PORTAL-5 data layer: client portal invitations.
 *
 * One row per invited person in `pm_portal_access`. The `token` is the secret
 * that unlocks `/portal/:token` — treat it like a password: only PM/BA users
 * ever see it, and revoking flips `is_active` so the link dies immediately.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { drainPortalEmails } from "@/lib/pm/portalNotify";

export interface PortalAccess {
  id: string;
  token: string;
  email: string;
  label: string | null;
  client_id: string | null;
  created_by: string | null;
  is_active: boolean;
  last_accessed_at: string | null;
  invite_sent_at: string | null;
  created_at: string;
}

/** Absolute URL a client uses to open their portal. */
export function portalUrl(token: string): string {
  return `${window.location.origin}/portal/${token}`;
}

export async function fetchPortalAccess(clientId: string): Promise<PortalAccess[]> {
  const { data, error } = await supabase
    .from("pm_portal_access")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortalAccess[];
}

export async function createPortalAccess(input: {
  clientId: string;
  email: string;
  label?: string | null;
  createdBy?: string | null;
}): Promise<PortalAccess> {
  const { data, error } = await supabase
    .from("pm_portal_access")
    .insert({
      client_id: input.clientId,
      email: input.email.trim().toLowerCase(),
      label: input.label?.trim() || null,
      created_by: input.createdBy ?? null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as PortalAccess;
  await queueInvite(row);
  return row;
}

/** Records the invite so PORTAL-6's mailer can pick it up, and stamps invite_sent_at. */
export async function queueInvite(access: PortalAccess): Promise<void> {
  await supabase.from("pm_portal_notifications").insert({
    portal_access_id: access.id,
    kind: "portal_invite",
    subject: "Your project portal",
    message: portalUrl(access.token),
  });
  await supabase
    .from("pm_portal_access")
    .update({ invite_sent_at: new Date().toISOString() })
    .eq("id", access.id);
  drainPortalEmails();
}

export async function setPortalAccessActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("pm_portal_access").update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

export async function deletePortalAccess(id: string): Promise<void> {
  const { error } = await supabase.from("pm_portal_access").delete().eq("id", id);
  if (error) throw error;
}

/** Portal invites for one client, with a reload handle. */
export function useClientPortalAccess(clientId: string | null | undefined) {
  const [rows, setRows] = useState<PortalAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!clientId) { setRows([]); setLoading(false); return; }
    setLoading(true); setError(false);
    try {
      setRows(await fetchPortalAccess(clientId));
    } catch (e) {
      console.error("fetchPortalAccess failed", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, error, reload };
}

/** Set of client IDs that have at least one active portal invite. Used for badges. */
export function useClientsWithPortal(): Set<string> {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pm_portal_access")
        .select("client_id")
        .eq("is_active", true);
      if (cancelled) return;
      setSet(new Set(((data ?? []) as { client_id: string | null }[]).map(r => r.client_id).filter(Boolean) as string[]));
    })();
    return () => { cancelled = true; };
  }, []);
  return set;
}

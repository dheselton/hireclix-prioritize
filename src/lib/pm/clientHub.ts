/**
 * CLIENT-2 / CLIENT-3 data layer for the client hub at `/pm/clients/:id`.
 *
 * Aggregates everything we know about one client (projects, task health, time,
 * portal invites) plus the two client-scoped collections: notes and assets.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isDone, type PmTask, type TaskStatus } from "@/types/pm";
import { todayISO } from "@/lib/pm/format";
import { isHardOverdue } from "@/lib/pm/dueState";
import {
  normalizeClientName,
  clientNameKey,
  isUniqueViolation,
  uniqueViolationMessage,
} from "@/lib/pm/identity";
import { refreshClientNames, refreshInternalClients } from "@/lib/pm/clients";

export interface ClientRecord {
  id: string;
  name: string;
  notes: string | null;
  is_internal: boolean;
  archived_at: string | null;
  created_at: string;
  logo_path?: string | null;
}

export interface ClientProjectRow {
  id: string;
  title: string;
  status: string;
  work_type: string | null;
  type: string | null;
  go_live_date: string | null;
  start_date: string | null;
  created_at: string;
  client_contact_name: string | null;
  client_contact_email: string | null;
}

export interface ClientStats {
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  overdueTasks: number;
  unclaimedTasks: number;
  hours30d: number;
  portalInvites: number;
  nextGoLive: string | null;
}

export interface ClientContact {
  name: string;
  email: string | null;
  projectId: string;
  projectTitle: string;
}

const ACTIVE_EXCLUDED = new Set(["complete", "archived", "cancelled"]);

export function useClientRecord(clientId: string | undefined) {
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("clients")
      .select("id,name,notes,is_internal,archived_at,created_at,logo_path")
      .eq("id", clientId)
      .maybeSingle();
    setClient((data ?? null) as ClientRecord | null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { client, loading, reload };
}

/** Projects + tasks + time + portal invites rolled into actionable numbers. */
export function useClientHub(clientId: string | undefined) {
  const [projects, setProjects] = useState<ClientProjectRow[]>([]);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [{ data: projRows, error: projErr }, { count: inviteCount }] = await Promise.all([
        supabase
          .from("pm_projects")
          .select("id,title,status,work_type,type,go_live_date,start_date,created_at,client_contact_name,client_contact_email")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("pm_portal_access")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("is_active", true),
      ]);
      if (projErr) throw projErr;

      const projs = (projRows ?? []) as ClientProjectRow[];
      const ids = projs.map(p => p.id);

      let taskRows: PmTask[] = [];
      if (ids.length) {
        const { data: t, error: tErr } = await supabase
          .from("pm_tasks")
          .select("*")
          .in("project_id", ids);
        if (tErr) throw tErr;
        taskRows = (t ?? []) as unknown as PmTask[];
      }

      // Hours logged in the last 30 days against this client's tasks.
      let minutes = 0;
      const taskIds = taskRows.map(t => t.id);
      if (taskIds.length) {
        const since = new Date(Date.now() - 30 * 864e5).toISOString();
        const { data: entries } = await supabase
          .from("pm_time_entries")
          .select("minutes,task_id")
          .gte("logged_at", since)
          .in("task_id", taskIds);
        for (const e of ((entries ?? []) as { minutes: number }[])) minutes += e.minutes ?? 0;
      }

      const today = todayISO();
      const open = taskRows.filter(t => !isDone(t.status as TaskStatus));
      const nextGoLive = projs
        .filter(p => p.go_live_date && !ACTIVE_EXCLUDED.has(p.status) && p.go_live_date >= today)
        .map(p => p.go_live_date!)
        .sort()[0] ?? null;

      setProjects(projs);
      setTasks(taskRows);
      setStats({
        activeProjects: projs.filter(p => !ACTIVE_EXCLUDED.has(p.status)).length,
        totalProjects: projs.length,
        openTasks: open.length,
        overdueTasks: open.filter(t => isHardOverdue(t, today)).length,
        unclaimedTasks: open.filter(t => t.status === "unclaimed").length,
        hours30d: Math.round((minutes / 60) * 10) / 10,
        portalInvites: inviteCount ?? 0,
        nextGoLive,
      });

      const seen = new Set<string>();
      const cs: ClientContact[] = [];
      for (const p of projs) {
        const key = (p.client_contact_email ?? p.client_contact_name ?? "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        cs.push({
          name: p.client_contact_name ?? p.client_contact_email!,
          email: p.client_contact_email,
          projectId: p.id,
          projectTitle: p.title,
        });
      }
      setContacts(cs);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { projects, tasks, stats, contacts, loading, error, reload };
}

// ---------- Notes ----------

export interface ClientNote {
  id: string;
  client_id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientNotes(clientId: string | undefined) {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("pm_client_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as ClientNote[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { notes, loading, reload };
}

export async function createClientNote(clientId: string, body: string, authorId: string | null) {
  const { error } = await supabase.from("pm_client_notes").insert({ client_id: clientId, body, author_id: authorId });
  if (error) throw error;
}

export async function updateClientNote(id: string, body: string) {
  const { error } = await supabase.from("pm_client_notes").update({ body }).eq("id", id);
  if (error) throw error;
}

export async function deleteClientNote(id: string) {
  const { error } = await supabase.from("pm_client_notes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Assets ----------

export const CLIENT_ASSET_BUCKET = "client-assets";

export interface ClientAsset {
  id: string;
  client_id: string;
  name: string;
  path: string;
  label: string | null;
  content_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  /** Signed URL, resolved client-side (bucket is private). */
  url?: string;
}

async function signAssets(rows: ClientAsset[]): Promise<ClientAsset[]> {
  if (!rows.length) return rows;
  const { data } = await supabase.storage
    .from(CLIENT_ASSET_BUCKET)
    .createSignedUrls(rows.map(r => r.path), 3600);
  const byPath = new Map<string, string>();
  for (const s of (data ?? [])) if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
  return rows.map(r => ({ ...r, url: byPath.get(r.path) }));
}

export function useClientAssets(clientId: string | undefined) {
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("pm_client_assets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setAssets(await signAssets((data ?? []) as ClientAsset[]));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { assets, loading, reload };
}

/**
 * Upload one file into the private client-assets bucket + insert its row.
 * Rolls the storage object back if the DB insert fails, so we never leave orphans.
 */
export async function uploadClientAsset(clientId: string, file: File, uploadedBy: string | null) {
  const path = `client/${clientId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from(CLIENT_ASSET_BUCKET).upload(path, file);
  if (upErr) throw upErr;
  const { error: insErr } = await supabase.from("pm_client_assets").insert({
    client_id: clientId,
    name: file.name,
    path,
    content_type: file.type || null,
    file_size: file.size,
    uploaded_by: uploadedBy,
  });
  if (insErr) {
    await supabase.storage.from(CLIENT_ASSET_BUCKET).remove([path]);
    throw insErr;
  }
}

export async function deleteClientAsset(asset: ClientAsset) {
  const { error } = await supabase.from("pm_client_assets").delete().eq("id", asset.id);
  if (error) throw error;
  await supabase.storage.from(CLIENT_ASSET_BUCKET).remove([asset.path]);
}

// ---------- Client mutations ----------

export type CreatedClient = {
  id: string;
  name: string;
  /** True when an existing row was reused instead of inserting a duplicate. */
  existed: boolean;
  /** True when an archived client was restored as part of reuse. */
  restored: boolean;
};

/** Find a client by the same normalized key as the DB unique index. */
export async function findClientByNormalizedName(
  name: string,
): Promise<{ id: string; name: string; archived_at: string | null } | null> {
  const key = clientNameKey(name);
  if (!key) return null;

  // Client roster is small; load names and match the unique-index key exactly
  // (trim + collapse whitespace + case-insensitive).
  const { data, error } = await supabase
    .from("clients")
    .select("id,name,archived_at");
  if (error) throw error;

  const hit = ((data ?? []) as { id: string; name: string; archived_at: string | null }[])
    .find((c) => clientNameKey(c.name) === key);
  return hit ?? null;
}

/**
 * Create a client, or return the existing one when the normalized name already exists.
 * Race-safe: unique index is the source of truth; on conflict we re-fetch.
 * Archived matches are restored so the client is usable again.
 */
export async function createClient(input: {
  name: string;
  notes?: string | null;
  is_internal?: boolean;
}): Promise<CreatedClient> {
  const name = normalizeClientName(input.name);
  if (!name) throw new Error("Client name is required");

  const existing = await findClientByNormalizedName(name);
  if (existing) {
    let restored = false;
    if (existing.archived_at) {
      await archiveClient(existing.id, false);
      restored = true;
    }
    refreshClientNames();
    refreshInternalClients();
    return { id: existing.id, name: existing.name, existed: true, restored };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      notes: input.notes?.trim() || null,
      is_internal: input.is_internal ?? false,
    })
    .select("id,name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const again = await findClientByNormalizedName(name);
      if (again) {
        let restored = false;
        if (again.archived_at) {
          await archiveClient(again.id, false);
          restored = true;
        }
        refreshClientNames();
        refreshInternalClients();
        return { id: again.id, name: again.name, existed: true, restored };
      }
    }
    throw new Error(uniqueViolationMessage(error, "Failed to create client"));
  }

  refreshClientNames();
  refreshInternalClients();
  return {
    id: (data as { id: string; name: string }).id,
    name: (data as { id: string; name: string }).name,
    existed: false,
    restored: false,
  };
}

export async function updateClient(
  id: string,
  patch: { name?: string; notes?: string | null; is_internal?: boolean; logo_path?: string | null },
) {
  const next = {
    ...patch,
    ...(patch.name !== undefined ? { name: normalizeClientName(patch.name) } : {}),
  };
  if (next.name !== undefined && !next.name) {
    throw new Error("Client name is required");
  }

  const { error } = await supabase.from("clients").update(next).eq("id", id);
  if (error) {
    throw new Error(uniqueViolationMessage(error, "Failed to update client"));
  }
}

export async function archiveClient(id: string, archived: boolean) {
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Logos ----------

export const CLIENT_LOGO_BUCKET = "client-logos";

export function clientLogoPublicUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  const { data } = supabase.storage.from(CLIENT_LOGO_BUCKET).getPublicUrl(logoPath);
  return data?.publicUrl ?? null;
}

/**
 * Upload a logo into the public client-logos bucket and set clients.logo_path.
 * Rolls the storage object back if the DB update fails.
 */
export async function uploadClientLogo(clientId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${clientId}/logo.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(CLIENT_LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) throw upErr;
  try {
    await updateClient(clientId, { logo_path: path });
  } catch (err) {
    await supabase.storage.from(CLIENT_LOGO_BUCKET).remove([path]);
    throw err;
  }
  return path;
}

export async function removeClientLogo(clientId: string, logoPath: string | null) {
  await updateClient(clientId, { logo_path: null });
  if (logoPath) {
    await supabase.storage.from(CLIENT_LOGO_BUCKET).remove([logoPath]);
  }
}

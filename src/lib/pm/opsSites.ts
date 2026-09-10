/**
 * Careersite-ops site catalog cache + linking helpers.
 * Ops is source of truth for live sites; Prioritize links projects for tickets.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@/lib/pm/clientHub";
import { emitTasksChanged } from "@/lib/pm/refresh";

export type OpsHealthStatus = "up" | "down" | "degraded" | "unknown";

export type PmOpsSite = {
  ops_site_id: string;
  name: string;
  client_name: string | null;
  prod_url: string | null;
  platform: string | null;
  health_status: OpsHealthStatus;
  last_checked_at: string | null;
  project_id: string | null;
  client_id: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
};

export type OpsSitePickerRow = {
  opsSiteId: string;
  projectId: string | null;
  name: string;
  projectTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  healthStatus: OpsHealthStatus;
  prodUrl: string | null;
};

function parseSite(row: any): PmOpsSite {
  return {
    ops_site_id: row.ops_site_id,
    name: row.name,
    client_name: row.client_name ?? null,
    prod_url: row.prod_url ?? null,
    platform: row.platform ?? null,
    health_status: (row.health_status ?? "unknown") as OpsHealthStatus,
    last_checked_at: row.last_checked_at ?? null,
    project_id: row.project_id ?? null,
    client_id: row.client_id ?? null,
    synced_at: row.synced_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchOpsSites(): Promise<PmOpsSite[]> {
  const { data, error } = await supabase
    .from("pm_ops_sites")
    .select("*")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as any[]).map(parseSite);
}

/** Linked ops sites for vendor “Add affected sites” (project_id required). */
export async function fetchLinkedOpsSitesForPicker(): Promise<OpsSitePickerRow[]> {
  const { data, error } = await supabase
    .from("pm_ops_sites")
    .select("ops_site_id, name, client_name, prod_url, health_status, project_id, client_id, pm_projects(title)")
    .not("project_id", "is", null)
    .order("name");
  if (error) {
    // Table may not exist yet before migration — fall back silently.
    if (error.code === "42P01" || /does not exist|relation/i.test(error.message)) return [];
    throw error;
  }
  return ((data ?? []) as any[]).map((r) => ({
    opsSiteId: r.ops_site_id,
    projectId: r.project_id,
    name: r.name,
    projectTitle: r.pm_projects?.title ?? null,
    clientId: r.client_id,
    clientName: r.client_name,
    healthStatus: (r.health_status ?? "unknown") as OpsHealthStatus,
    prodUrl: r.prod_url,
  }));
}

export async function fetchUnmappedOpsSites(): Promise<PmOpsSite[]> {
  const { data, error } = await supabase
    .from("pm_ops_sites")
    .select("*")
    .is("project_id", null)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as any[]).map(parseSite);
}

export async function linkOpsSiteToProject(
  opsSiteId: string,
  projectId: string,
  clientId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("pm_ops_sites")
    .update({
      project_id: projectId,
      client_id: clientId ?? null,
    })
    .eq("ops_site_id", opsSiteId);
  if (error) throw error;

  // Stamp ops_site_id on the project's custom_fields for reverse lookup.
  const { data: proj } = await supabase
    .from("pm_projects")
    .select("custom_fields, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (proj) {
    const cf = { ...((proj as any).custom_fields ?? {}), ops_site_id: opsSiteId };
    await supabase
      .from("pm_projects")
      .update({
        custom_fields: cf,
        ...(clientId || (proj as any).client_id
          ? {}
          : {}),
      })
      .eq("id", projectId);
    if (clientId && !(proj as any).client_id) {
      await supabase.from("pm_projects").update({ client_id: clientId }).eq("id", projectId);
    }
  }
}

/**
 * Create a Support-mode live career site inventory shell from an unmapped ops row.
 * Find-or-creates the client; does not start a build workflow.
 */
export async function createLiveSiteFromOps(site: PmOpsSite): Promise<string> {
  const name = site.name?.trim();
  if (!name) throw new Error("Ops site is missing a name");
  if (site.project_id) throw new Error("Ops site is already linked to a Prioritize project");

  const clientName = (site.client_name?.trim() || name);
  const client = await createClient({ name: clientName });
  const now = new Date().toISOString();

  const { data: project, error } = await supabase
    .from("pm_projects")
    .insert({
      title: name,
      type: "career_site",
      work_type: "project",
      status: "active",
      client_id: client.id,
      custom_fields: {
        support_mode_at: now,
        ops_site_id: site.ops_site_id,
        prod_url: site.prod_url,
        platform: site.platform,
        imported_from_ops: true,
      },
      creation_source: "automation",
      creation_context: {
        source: "ops-create-live-site",
        ops_site_id: site.ops_site_id,
      },
    })
    .select("id")
    .single();

  if (error) throw error;
  const projectId = (project as { id: string }).id;

  await linkOpsSiteToProject(site.ops_site_id, projectId, client.id);
  emitTasksChanged();
  return projectId;
}

export async function createLiveSitesFromOps(sites: PmOpsSite[]): Promise<{
  created: number;
  failed: number;
  errors: { opsSiteId: string; name: string; message: string }[];
}> {
  let created = 0;
  let failed = 0;
  const errors: { opsSiteId: string; name: string; message: string }[] = [];

  for (const site of sites) {
    try {
      await createLiveSiteFromOps(site);
      created += 1;
    } catch (e: unknown) {
      failed += 1;
      errors.push({
        opsSiteId: site.ops_site_id,
        name: site.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { created, failed, errors };
}

export async function unlinkOpsSite(opsSiteId: string): Promise<void> {
  const { data: site } = await supabase
    .from("pm_ops_sites")
    .select("project_id")
    .eq("ops_site_id", opsSiteId)
    .maybeSingle();

  const { error } = await supabase
    .from("pm_ops_sites")
    .update({ project_id: null })
    .eq("ops_site_id", opsSiteId);
  if (error) throw error;

  const projectId = (site as any)?.project_id as string | null;
  if (projectId) {
    const { data: proj } = await supabase
      .from("pm_projects")
      .select("custom_fields")
      .eq("id", projectId)
      .maybeSingle();
    if (proj) {
      const cf = { ...((proj as any).custom_fields ?? {}) };
      delete cf.ops_site_id;
      await supabase.from("pm_projects").update({ custom_fields: cf }).eq("id", projectId);
    }
  }
}

/** Invoke sync-ops-sites edge function (manual Sync now). */
export async function triggerOpsSitesSync(): Promise<{
  synced: number;
  linked: number;
  created?: number;
  unmapped: number;
  skipped?: boolean;
  message?: string;
}> {
  const { data, error } = await supabase.functions.invoke("sync-ops-sites", {
    body: {},
  });
  if (error) throw error;
  return data as any;
}

export type OpsAlertEvent = {
  id: string;
  received_at: string;
  event: string;
  ops_site_id: string;
  alert_id: string | null;
  action: string | null;
  project_id: string | null;
  source: "ops" | "test";
  ok: boolean;
  message: string | null;
};

export type OpsAlertActionResult = {
  ok: boolean;
  action: string;
  project_id?: string;
  linked?: boolean;
  source?: string;
  message?: string;
  error?: string;
  /** Echoed so callers can reuse for recovery / dedupe. */
  alert_id?: string;
};

/** Fetch recent inbound ops alert events (test + production). */
export async function fetchRecentOpsAlertEvents(limit = 20): Promise<OpsAlertEvent[]> {
  const { data, error } = await supabase
    .from("pm_ops_alert_events")
    .select("id, received_at, event, ops_site_id, alert_id, action, project_id, source, ok, message")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01" || /does not exist|relation/i.test(error.message)) return [];
    throw error;
  }
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    received_at: r.received_at,
    event: r.event,
    ops_site_id: r.ops_site_id,
    alert_id: r.alert_id ?? null,
    action: r.action ?? null,
    project_id: r.project_id ?? null,
    source: (r.source === "test" ? "test" : "ops") as "ops" | "test",
    ok: !!r.ok,
    message: r.message ?? null,
  }));
}

/**
 * Fire a test down/up alert via ops-site-alert (JWT auth — no API key in browser).
 * Uses a stable alert_id for the session so down → down dedupes and up recovers the same ticket.
 */
export async function sendTestOpsAlert(params: {
  event: "site.down" | "site.up";
  opsSiteId: string;
  siteName?: string | null;
  prodUrl?: string | null;
  /** Reuse across down/up so recovery finds the open ticket. */
  alertId?: string;
}): Promise<OpsAlertActionResult> {
  const alertId =
    params.alertId ??
    `test-${params.opsSiteId}-${Date.now()}`;
  const { data, error } = await supabase.functions.invoke("ops-site-alert", {
    body: {
      event: params.event,
      ops_site_id: params.opsSiteId,
      site_name: params.siteName ?? undefined,
      prod_url: params.prodUrl ?? undefined,
      detected_at: new Date().toISOString(),
      alert_id: alertId,
      source: "test",
    },
  });
  if (error) throw error;
  return { ...(data as OpsAlertActionResult), alert_id: alertId };
}

export function useRecentOpsAlertEvents(limit = 20) {
  return useQuery({
    queryKey: ["pm-ops-alert-events", limit],
    queryFn: () => fetchRecentOpsAlertEvents(limit),
    staleTime: 15_000,
  });
}

export function healthBadgeClass(status: OpsHealthStatus | string | null | undefined): string {
  switch (status) {
    case "up":
      return "bg-success/15 text-success border-success/30";
    case "down":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "degraded":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function useOpsSites() {
  return useQuery({
    queryKey: ["pm-ops-sites"],
    queryFn: fetchOpsSites,
    staleTime: 30_000,
  });
}

export function useUnmappedOpsSites() {
  return useQuery({
    queryKey: ["pm-ops-sites-unmapped"],
    queryFn: fetchUnmappedOpsSites,
    staleTime: 30_000,
  });
}

export function opsSiteByProjectId(sites: PmOpsSite[]): Map<string, PmOpsSite> {
  const map = new Map<string, PmOpsSite>();
  for (const s of sites) {
    if (s.project_id) map.set(s.project_id, s);
  }
  return map;
}

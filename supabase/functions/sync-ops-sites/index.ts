/**
 * Pull live site catalog from careersite-ops and upsert into pm_ops_sites.
 *
 * Env:
 *   OPS_SITES_API_URL  — e.g. https://careersite-ops.hireclix.com/api/v1/sites
 *   OPS_SITES_API_KEY  — shared secret (x-api-key)
 *
 * Autolink: match prod_url (normalized) to live career site projects, or
 * custom_fields.ops_site_id / site_url / clients.
 * Remaining unmapped rows get Support-mode live-site shells auto-created.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

type OpsSitePayload = {
  id: string;
  name: string;
  client_name?: string | null;
  prod_url?: string | null;
  platform?: string | null;
  status?: string | null;
  last_checked_at?: string | null;
};

type Sb = ReturnType<typeof createClient>;

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `${host}${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

function coerceHealth(status: string | null | undefined): string {
  const s = (status ?? "unknown").toLowerCase();
  if (s === "up" || s === "ok" || s === "healthy") return "up";
  if (s === "down" || s === "outage" || s === "offline") return "down";
  if (s === "degraded" || s === "partial") return "degraded";
  return "unknown";
}

/** Prefer Deno.env; fall back to vault via get_edge_secret (service role). */
async function resolveSecret(
  supabase: Sb,
  name: string,
): Promise<string | null> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const { data, error } = await supabase.rpc("get_edge_secret", { secret_name: name });
  if (error) {
    console.error(`get_edge_secret(${name}) failed:`, error.message);
    return null;
  }
  return typeof data === "string" && data.length > 0 ? data : null;
}

/** Normalize + strip trailing careers/jobs/career site(s) for brand matching. */
function clientNameStem(name: string): string {
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!key) return key;
  const stripped = key
    .replace(/\s+career\s+sites?$/i, "")
    .replace(/\s+(careers|jobs)$/i, "")
    .trim();
  return stripped || key;
}

async function findOrCreateClient(
  supabase: Sb,
  clientName: string,
  clientByName: Map<string, string>,
): Promise<string> {
  const trimmed = clientName.trim().replace(/\s+/g, " ");
  const key = trimmed.toLowerCase();
  const stem = clientNameStem(trimmed);

  const existing = clientByName.get(key) ?? clientByName.get(stem);
  if (existing) return existing;

  // Exact ilike first
  const { data: found } = await supabase
    .from("clients")
    .select("id, name")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (found?.id) {
    clientByName.set((found.name as string).trim().toLowerCase(), found.id);
    clientByName.set(clientNameStem(found.name as string), found.id);
    return found.id as string;
  }

  // Stem scan (roster is small)
  const { data: all } = await supabase.from("clients").select("id, name");
  const stemHit = ((all ?? []) as { id: string; name: string }[]).find(
    (c) => clientNameStem(c.name) === stem,
  );
  if (stemHit?.id) {
    clientByName.set(stemHit.name.trim().toLowerCase(), stemHit.id);
    clientByName.set(stem, stemHit.id);
    return stemHit.id;
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({ name: trimmed, is_internal: false })
    .select("id, name")
    .single();
  if (error) {
    // Race: unique name or stem — re-fetch
    const { data: againList } = await supabase.from("clients").select("id, name");
    const again = ((againList ?? []) as { id: string; name: string }[]).find(
      (c) => c.name.trim().toLowerCase() === key || clientNameStem(c.name) === stem,
    );
    if (again?.id) {
      clientByName.set(again.name.trim().toLowerCase(), again.id);
      clientByName.set(clientNameStem(again.name), again.id);
      return again.id;
    }
    throw error;
  }
  clientByName.set((created.name as string).trim().toLowerCase(), created.id);
  clientByName.set(clientNameStem(created.name as string), created.id);
  return created.id as string;
}

/** Create Support-mode live career site shell and link pm_ops_sites. */
async function createLiveSiteFromOpsRow(
  supabase: Sb,
  row: {
    ops_site_id: string;
    name: string;
    client_name?: string | null;
    prod_url?: string | null;
    platform?: string | null;
  },
  clientByName: Map<string, string>,
): Promise<{ projectId: string; clientId: string }> {
  const name = row.name.trim();
  const clientName = (row.client_name?.trim() || name);
  const clientId = await findOrCreateClient(supabase, clientName, clientByName);
  const now = new Date().toISOString();

  const { data: project, error } = await supabase
    .from("pm_projects")
    .insert({
      title: name,
      type: "career_site",
      work_type: "project",
      status: "active",
      client_id: clientId,
      custom_fields: {
        support_mode_at: now,
        ops_site_id: row.ops_site_id,
        prod_url: row.prod_url ?? null,
        platform: row.platform ?? null,
        imported_from_ops: true,
      },
      creation_source: "automation",
      creation_context: {
        source: "ops-sync-auto-create",
        ops_site_id: row.ops_site_id,
      },
    })
    .select("id")
    .single();
  if (error) throw error;

  const projectId = (project as { id: string }).id;
  await supabase
    .from("pm_ops_sites")
    .update({ project_id: projectId, client_id: clientId })
    .eq("ops_site_id", row.ops_site_id);

  return { projectId, clientId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const apiUrl = await resolveSecret(supabase, "OPS_SITES_API_URL");
    const apiKey = await resolveSecret(supabase, "OPS_SITES_API_KEY");

    if (!apiUrl) {
      return new Response(
        JSON.stringify({
          skipped: true,
          message: "OPS_SITES_API_URL not configured — set secrets then re-run Sync",
          synced: 0,
          linked: 0,
          created: 0,
          unmapped: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ops sites API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const list: OpsSitePayload[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.sites)
      ? json.sites
      : Array.isArray(json?.data)
      ? json.data
      : [];

    const now = new Date().toISOString();

    // Load live projects for URL matching
    const { data: projects } = await supabase
      .from("pm_projects")
      .select("id, title, client_id, work_type, status, custom_fields")
      .eq("work_type", "project")
      .not("status", "in", '("complete","archived")');

    const liveProjects = ((projects ?? []) as any[]).filter(
      (p) => !!(p.custom_fields as { support_mode_at?: string } | null)?.support_mode_at,
    );

    const byOpsId = new Map<string, any>();
    const byUrl = new Map<string, any>();
    for (const p of liveProjects) {
      const cf = (p.custom_fields ?? {}) as Record<string, unknown>;
      if (typeof cf.ops_site_id === "string") byOpsId.set(cf.ops_site_id, p);
      const urlKeys = [cf.prod_url, cf.site_url, cf.live_url]
        .filter((u): u is string => typeof u === "string")
        .map(normalizeUrl)
        .filter((u): u is string => !!u);
      for (const k of urlKeys) byUrl.set(k, p);
    }

    const { data: clients } = await supabase.from("clients").select("id, name");
    const clientByName = new Map<string, string>();
    for (const c of (clients ?? []) as { id: string; name: string }[]) {
      const key = c.name.trim().toLowerCase();
      clientByName.set(key, c.id);
      clientByName.set(clientNameStem(c.name), c.id);
    }

    let linked = 0;
    let unmappedAfterMatch = 0;

    for (const site of list) {
      if (!site?.id || !site?.name) continue;
      const health = coerceHealth(site.status);
      const norm = normalizeUrl(site.prod_url ?? null);

      let projectId: string | null = null;
      let clientId: string | null = null;

      const byId = byOpsId.get(site.id);
      if (byId) {
        projectId = byId.id;
        clientId = byId.client_id;
      } else if (norm && byUrl.has(norm)) {
        const p = byUrl.get(norm);
        projectId = p.id;
        clientId = p.client_id;
      }

      if (!clientId && site.client_name) {
        clientId = clientByName.get(site.client_name.trim().toLowerCase()) ?? null;
      }

      // Preserve existing manual link if API match missed
      const { data: existing } = await supabase
        .from("pm_ops_sites")
        .select("project_id, client_id")
        .eq("ops_site_id", site.id)
        .maybeSingle();

      if (!projectId && (existing as any)?.project_id) {
        projectId = (existing as any).project_id;
        clientId = clientId ?? (existing as any).client_id;
      }

      if (projectId) linked += 1;
      else unmappedAfterMatch += 1;

      const { error } = await supabase.from("pm_ops_sites").upsert(
        {
          ops_site_id: site.id,
          name: site.name,
          client_name: site.client_name ?? null,
          prod_url: site.prod_url ?? null,
          platform: site.platform ?? null,
          health_status: health,
          last_checked_at: site.last_checked_at ?? now,
          project_id: projectId,
          client_id: clientId,
          synced_at: now,
        },
        { onConflict: "ops_site_id" },
      );
      if (error) throw error;

      // Stamp reverse link on project custom_fields
      if (projectId) {
        const p = liveProjects.find((x) => x.id === projectId) ?? byId;
        const cf = { ...(p?.custom_fields ?? {}), ops_site_id: site.id };
        if (site.prod_url) (cf as any).prod_url = site.prod_url;
        await supabase.from("pm_projects").update({ custom_fields: cf }).eq("id", projectId);
      }
    }

    // Auto-create Support-mode shells for remaining unmapped rows
    let created = 0;
    const { data: stillUnmapped } = await supabase
      .from("pm_ops_sites")
      .select("ops_site_id, name, client_name, prod_url, platform")
      .is("project_id", null);

    for (const row of (stillUnmapped ?? []) as any[]) {
      if (!row?.ops_site_id || !row?.name) continue;
      try {
        const result = await createLiveSiteFromOpsRow(supabase, row, clientByName);
        created += 1;
        linked += 1;
        // Keep local maps fresh for subsequent rows
        byOpsId.set(row.ops_site_id, { id: result.projectId, client_id: result.clientId });
      } catch (e) {
        console.error(`auto-create failed for ${row.ops_site_id}:`, e);
      }
    }

    const unmapped = Math.max(0, unmappedAfterMatch - created);

    return new Response(
      JSON.stringify({
        synced: list.length,
        linked,
        created,
        unmapped,
        skipped: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-ops-sites error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

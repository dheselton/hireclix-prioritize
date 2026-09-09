/**
 * Inbound webhook from careersite-ops for site down / recovery alerts.
 *
 * POST /functions/v1/ops-site-alert
 * Header: x-api-key: OPS_SITE_ALERT_API_KEY
 *
 * Body:
 * {
 *   "event": "site.down" | "site.up" | "site.recovered",
 *   "ops_site_id": "...",
 *   "prod_url": "https://...",
 *   "site_name": "...",
 *   "detected_at": "ISO-8601",
 *   "alert_id": "ops-unique-alert-id"
 * }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

type AlertBody = {
  event: string;
  ops_site_id?: string;
  prod_url?: string;
  site_name?: string;
  detected_at?: string;
  alert_id?: string;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Prefer Deno.env; fall back to vault via get_edge_secret (service role). */
async function resolveSecret(
  supabase: ReturnType<typeof createClient>,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const apiKey = req.headers.get("x-api-key");
    const expected = await resolveSecret(supabase, "OPS_SITE_ALERT_API_KEY");
    if (!expected || !apiKey || apiKey !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as AlertBody;
    const event = (body.event ?? "").toLowerCase();
    const opsSiteId = body.ops_site_id?.trim();
    const alertId = body.alert_id?.trim() || `ops-${opsSiteId}-${body.detected_at ?? Date.now()}`;
    const siteName = body.site_name?.trim() || "Career site";
    const detectedAt = body.detected_at ?? new Date().toISOString();

    if (!opsSiteId) {
      return new Response(JSON.stringify({ error: "ops_site_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: opsSite } = await supabase
      .from("pm_ops_sites")
      .select("*")
      .eq("ops_site_id", opsSiteId)
      .maybeSingle();

    // Update health cache if we have a row
    if (opsSite) {
      const health =
        event === "site.down" ? "down" : event === "site.up" || event === "site.recovered" ? "up" : (opsSite as any).health_status;
      await supabase
        .from("pm_ops_sites")
        .update({ health_status: health, last_checked_at: detectedAt })
        .eq("ops_site_id", opsSiteId);
    }

    const projectId = (opsSite as any)?.project_id as string | null;
    const clientId = (opsSite as any)?.client_id as string | null;
    const displayName = (opsSite as any)?.name ?? siteName;
    const prodUrl = body.prod_url ?? (opsSite as any)?.prod_url ?? null;

    // Find open alert request for this ops site / alert
    const findOpenAlert = async () => {
      let q = supabase
        .from("pm_projects")
        .select("*")
        .eq("work_type", "request")
        .not("status", "in", '("complete","archived")')
        .contains("custom_fields", { ops_alert_active: true, ops_site_id: opsSiteId });
      if (projectId) q = q.eq("parent_project_id", projectId);
      const { data } = await q.order("created_at", { ascending: false }).limit(5);
      const rows = (data ?? []) as any[];
      // Prefer exact alert_id match, else any active for site
      const byAlert = rows.find((r) => r.custom_fields?.ops_alert_id === alertId);
      return byAlert ?? rows[0] ?? null;
    };

    const isDown = event === "site.down";
    const isUp = event === "site.up" || event === "site.recovered";

    if (isUp) {
      const open = await findOpenAlert();
      if (open) {
        const cf = {
          ...(open.custom_fields ?? {}),
          ops_alert_active: false,
          ops_recovered_at: detectedAt,
        };
        await supabase.from("pm_projects").update({ custom_fields: cf }).eq("id", open.id);
        await supabase.from("pm_comments").insert({
          project_id: open.id,
          body: `Site recovered (ops alert). Detected at ${detectedAt}.${prodUrl ? ` URL: ${prodUrl}` : ""} Confirm and close when ready.`,
          visibility: "internal",
        });
        return new Response(
          JSON.stringify({ ok: true, action: "commented_recovery", project_id: open.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, action: "no_open_alert" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isDown) {
      return new Response(JSON.stringify({ error: `Unsupported event: ${event}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup: existing open alert for this site
    const existing = await findOpenAlert();
    if (existing) {
      await supabase.from("pm_comments").insert({
        project_id: existing.id,
        body: `Repeat down alert from ops (${alertId}) at ${detectedAt}.${prodUrl ? ` ${prodUrl}` : ""}`,
        visibility: "internal",
      });
      await supabase
        .from("pm_projects")
        .update({
          custom_fields: {
            ...(existing.custom_fields ?? {}),
            ops_alert_active: true,
            ops_last_alert_id: alertId,
            ops_last_detected_at: detectedAt,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return new Response(
        JSON.stringify({ ok: true, action: "deduped", project_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve client for create
    let resolvedClientId = clientId;
    if (!resolvedClientId && projectId) {
      const { data: parent } = await supabase
        .from("pm_projects")
        .select("client_id")
        .eq("id", projectId)
        .maybeSingle();
      resolvedClientId = (parent as any)?.client_id ?? null;
    }

    if (!resolvedClientId) {
      // Create unlinked inbox-style request under a synthetic needs-mapping path:
      // still need a client_id — use first matching client by ops client_name or fail soft.
      if ((opsSite as any)?.client_name) {
        const { data: c } = await supabase
          .from("clients")
          .select("id")
          .ilike("name", (opsSite as any).client_name)
          .limit(1)
          .maybeSingle();
        resolvedClientId = (c as any)?.id ?? null;
      }
    }

    if (!resolvedClientId) {
      return new Response(
        JSON.stringify({
          ok: false,
          action: "unmapped_no_client",
          message: `Site ${opsSiteId} has no linked Prioritize project/client. Sync + map on Live Sites, then alerts will create tickets.`,
        }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const today = todayISO();
    const title = `[Site down] ${displayName}`;
    const description = [
      `Automated alert from careersite-ops.`,
      prodUrl ? `URL: ${prodUrl}` : null,
      `Ops site id: ${opsSiteId}`,
      `Alert id: ${alertId}`,
      `Detected: ${detectedAt}`,
      !projectId ? "⚠️ Site is not linked to a live career site project in Prioritize — map it on Live Career Sites." : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: project, error: projErr } = await supabase
      .from("pm_projects")
      .insert({
        title,
        type: "quick_request",
        work_type: "request",
        status: "active",
        client_id: resolvedClientId,
        parent_project_id: projectId,
        description,
        start_date: today,
        custom_fields: {
          request_type: "careersite_bug",
          ops_site_id: opsSiteId,
          ops_alert_id: alertId,
          ops_alert_active: true,
          ops_detected_at: detectedAt,
          ops_prod_url: prodUrl,
          is_support: true,
        },
        creation_source: "automation",
        creation_context: { source: "ops-site-alert", ops_site_id: opsSiteId, alert_id: alertId },
      })
      .select()
      .single();

    if (projErr) throw projErr;

    const { error: taskErr } = await supabase.from("pm_tasks").insert({
      project_id: (project as any).id,
      title,
      description,
      type: "dev",
      status: "unclaimed",
      priority: "urgent",
      tags: ["support", "ops-alert"],
      custom_fields: {
        ops_site_id: opsSiteId,
        ops_alert_id: alertId,
        is_support: true,
      },
      creation_source: "automation",
      creation_context: { source: "ops-site-alert" },
    });
    if (taskErr) throw taskErr;

    return new Response(
      JSON.stringify({
        ok: true,
        action: "created",
        project_id: (project as any).id,
        linked: !!projectId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ops-site-alert error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

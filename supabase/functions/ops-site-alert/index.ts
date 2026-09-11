/**
 * Inbound webhook from careersite-ops for site down / recovery alerts.
 * Also accepts authenticated JWT calls from Live Career Sites for test alerts.
 *
 * POST /functions/v1/ops-site-alert
 * Auth: x-api-key: OPS_SITE_ALERT_API_KEY  OR  Authorization: Bearer <user JWT>
 *
 * Body:
 * {
 *   "event": "site.down" | "site.up" | "site.recovered",
 *   "ops_site_id": "...",
 *   "prod_url": "https://...",
 *   "site_name": "...",
 *   "detected_at": "ISO-8601",
 *   "alert_id": "ops-unique-alert-id",
 *   "source": "ops" | "test"   // JWT path forces "test"
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
  source?: string;
};

type Sb = ReturnType<typeof createClient>;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
): Promise<string> {
  const trimmed = clientName.trim().replace(/\s+/g, " ");
  const key = trimmed.toLowerCase();
  const stem = clientNameStem(trimmed);

  const { data: found } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (found?.id) return found.id as string;

  const { data: all } = await supabase.from("clients").select("id, name");
  const stemHit = ((all ?? []) as { id: string; name: string }[]).find(
    (c) => clientNameStem(c.name) === stem,
  );
  if (stemHit?.id) return stemHit.id;

  const { data: created, error } = await supabase
    .from("clients")
    .insert({ name: trimmed, is_internal: false })
    .select("id")
    .single();
  if (error) {
    const { data: againList } = await supabase.from("clients").select("id, name");
    const again = ((againList ?? []) as { id: string; name: string }[]).find(
      (c) => c.name.trim().toLowerCase() === key || clientNameStem(c.name) === stem,
    );
    if (again?.id) return again.id;
    throw error;
  }
  return (created as { id: string }).id;
}

/**
 * Ensure ops site is linked to a Support-mode live project + client.
 * Creates pm_ops_sites row and/or live-site shell as needed.
 */
async function ensureMappedSite(
  supabase: Sb,
  opts: {
    opsSiteId: string;
    siteName: string;
    prodUrl: string | null;
    existing: any | null;
  },
): Promise<{ projectId: string | null; clientId: string; opsSite: any }> {
  let opsSite = opts.existing;
  let projectId = (opsSite as any)?.project_id as string | null;
  let clientId = (opsSite as any)?.client_id as string | null;

  if (projectId && !clientId) {
    const { data: parent } = await supabase
      .from("pm_projects")
      .select("client_id")
      .eq("id", projectId)
      .maybeSingle();
    clientId = (parent as any)?.client_id ?? null;
  }

  if (!clientId && (opsSite as any)?.client_name) {
    clientId = await findOrCreateClient(supabase, (opsSite as any).client_name);
  }

  if (!clientId) {
    const nameForClient = (opsSite as any)?.name || opts.siteName || opts.opsSiteId;
    clientId = await findOrCreateClient(supabase, nameForClient);
  }

  // Upsert cache row if missing
  if (!opsSite) {
    const name = opts.siteName || opts.opsSiteId;
    const now = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("pm_ops_sites")
      .upsert(
        {
          ops_site_id: opts.opsSiteId,
          name,
          client_name: name,
          prod_url: opts.prodUrl,
          health_status: "unknown",
          last_checked_at: now,
          client_id: clientId,
          synced_at: now,
        },
        { onConflict: "ops_site_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    opsSite = inserted;
  } else if (!opsSite.client_id) {
    await supabase
      .from("pm_ops_sites")
      .update({ client_id: clientId })
      .eq("ops_site_id", opts.opsSiteId);
    opsSite = { ...opsSite, client_id: clientId };
  }

  projectId = (opsSite as any)?.project_id as string | null;

  if (!projectId) {
    const name = ((opsSite as any)?.name as string) || opts.siteName || opts.opsSiteId;
    const now = new Date().toISOString();
    const { data: project, error: projErr } = await supabase
      .from("pm_projects")
      .insert({
        title: name,
        type: "career_site",
        work_type: "project",
        status: "active",
        client_id: clientId,
        custom_fields: {
          support_mode_at: now,
          ops_site_id: opts.opsSiteId,
          prod_url: opts.prodUrl ?? (opsSite as any)?.prod_url ?? null,
          platform: (opsSite as any)?.platform ?? null,
          imported_from_ops: true,
        },
        creation_source: "automation",
        creation_context: {
          source: "ops-alert-auto-create",
          ops_site_id: opts.opsSiteId,
        },
      })
      .select("id")
      .single();
    if (projErr) throw projErr;
    projectId = (project as { id: string }).id;
    await supabase
      .from("pm_ops_sites")
      .update({ project_id: projectId, client_id: clientId })
      .eq("ops_site_id", opts.opsSiteId);
    opsSite = { ...opsSite, project_id: projectId, client_id: clientId };
  }

  return { projectId, clientId, opsSite };
}

async function logAlertEvent(
  supabase: Sb,
  row: {
    event: string;
    ops_site_id: string;
    alert_id: string | null;
    action: string;
    project_id?: string | null;
    source: "ops" | "test";
    payload: unknown;
    ok: boolean;
    message?: string | null;
  },
) {
  const { error } = await supabase.from("pm_ops_alert_events").insert({
    event: row.event,
    ops_site_id: row.ops_site_id,
    alert_id: row.alert_id,
    action: row.action,
    project_id: row.project_id ?? null,
    source: row.source,
    payload: row.payload ?? {},
    ok: row.ok,
    message: row.message ?? null,
  });
  if (error) console.error("pm_ops_alert_events insert failed:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: AlertBody | null = null;
  let source: "ops" | "test" = "ops";
  let authViaJwt = false;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const apiKey = req.headers.get("x-api-key");
    const expected = await resolveSecret(supabase, "OPS_SITE_ALERT_API_KEY");
    const apiKeyOk = !!(expected && apiKey && apiKey === expected);

    if (!apiKeyOk) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) {
        return jsonResponse({ error: "Unauthorized: Invalid API key" }, 401);
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
        { global: { headers: { Authorization: `Bearer ${jwt}` } } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return jsonResponse({ error: "Unauthorized: Invalid API key or session" }, 401);
      }
      authViaJwt = true;
    }

    body = (await req.json()) as AlertBody;
    const event = (body.event ?? "").toLowerCase();
    const opsSiteId = body.ops_site_id?.trim();
    const alertId = body.alert_id?.trim() || `ops-${opsSiteId}-${body.detected_at ?? Date.now()}`;
    const siteName = body.site_name?.trim() || "Career site";
    const detectedAt = body.detected_at ?? new Date().toISOString();

    // JWT UI tests always mark source=test; API-key callers may pass source=test explicitly
    if (authViaJwt || (body.source ?? "").toLowerCase() === "test") {
      source = "test";
    }

    if (!opsSiteId) {
      await logAlertEvent(supabase, {
        event: event || "unknown",
        ops_site_id: "",
        alert_id: alertId,
        action: "bad_payload",
        source,
        payload: body,
        ok: false,
        message: "ops_site_id required",
      });
      return jsonResponse({ error: "ops_site_id required" }, 400);
    }

    const { data: opsSiteRow } = await supabase
      .from("pm_ops_sites")
      .select("*")
      .eq("ops_site_id", opsSiteId)
      .maybeSingle();

    let opsSite = opsSiteRow as any;

    // Update health cache if we have a row
    if (opsSite) {
      const health =
        event === "site.down"
          ? "down"
          : event === "site.up" || event === "site.recovered"
          ? "up"
          : opsSite.health_status;
      await supabase
        .from("pm_ops_sites")
        .update({ health_status: health, last_checked_at: detectedAt })
        .eq("ops_site_id", opsSiteId);
      opsSite = { ...opsSite, health_status: health, last_checked_at: detectedAt };
    }

    let projectId = opsSite?.project_id as string | null;
    const displayName = opsSite?.name ?? siteName;
    const prodUrl = body.prod_url ?? opsSite?.prod_url ?? null;
    const isTest = source === "test";

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
          body: `${isTest ? "[TEST] " : ""}Site recovered (ops alert). Detected at ${detectedAt}.${prodUrl ? ` URL: ${prodUrl}` : ""} Confirm and close when ready.`,
          visibility: "internal",
        });
        await logAlertEvent(supabase, {
          event,
          ops_site_id: opsSiteId,
          alert_id: alertId,
          action: "commented_recovery",
          project_id: open.id,
          source,
          payload: body,
          ok: true,
        });
        return jsonResponse({ ok: true, action: "commented_recovery", project_id: open.id });
      }
      await logAlertEvent(supabase, {
        event,
        ops_site_id: opsSiteId,
        alert_id: alertId,
        action: "no_open_alert",
        source,
        payload: body,
        ok: true,
      });
      return jsonResponse({ ok: true, action: "no_open_alert" });
    }

    if (!isDown) {
      await logAlertEvent(supabase, {
        event,
        ops_site_id: opsSiteId,
        alert_id: alertId,
        action: "unsupported_event",
        source,
        payload: body,
        ok: false,
        message: `Unsupported event: ${event}`,
      });
      return jsonResponse({ error: `Unsupported event: ${event}` }, 400);
    }

    // Dedup: existing open alert for this site
    const existing = await findOpenAlert();
    if (existing) {
      await supabase.from("pm_comments").insert({
        project_id: existing.id,
        body: `${isTest ? "[TEST] " : ""}Repeat down alert from ops (${alertId}) at ${detectedAt}.${prodUrl ? ` ${prodUrl}` : ""}`,
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
      await logAlertEvent(supabase, {
        event,
        ops_site_id: opsSiteId,
        alert_id: alertId,
        action: "deduped",
        project_id: existing.id,
        source,
        payload: body,
        ok: true,
      });
      return jsonResponse({ ok: true, action: "deduped", project_id: existing.id });
    }

    // Auto-provision live site + client so we never soft-fail with 202
    const mapped = await ensureMappedSite(supabase, {
      opsSiteId,
      siteName: displayName,
      prodUrl,
      existing: opsSite,
    });
    projectId = mapped.projectId;
    const resolvedClientId = mapped.clientId;
    opsSite = mapped.opsSite;

    const today = todayISO();
    const finalTitle = isTest
      ? `[TEST][Site down] ${displayName}`
      : `[Site down] ${displayName}`;
    const description = [
      isTest
        ? `Test alert from Prioritize Live Career Sites.`
        : `Automated alert from careersite-ops.`,
      prodUrl ? `URL: ${prodUrl}` : null,
      `Ops site id: ${opsSiteId}`,
      `Alert id: ${alertId}`,
      `Detected: ${detectedAt}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: project, error: projErr } = await supabase
      .from("pm_projects")
      .insert({
        title: finalTitle,
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
          ...(isTest ? { ops_test: true } : {}),
        },
        creation_source: "automation",
        creation_context: {
          source: "ops-site-alert",
          ops_site_id: opsSiteId,
          alert_id: alertId,
          test: isTest,
        },
      })
      .select()
      .single();

    if (projErr) throw projErr;

    const { error: taskErr } = await supabase.from("pm_tasks").insert({
      project_id: (project as any).id,
      title: finalTitle,
      description,
      type: "dev",
      status: "unclaimed",
      priority: "urgent",
      tags: isTest ? ["support", "ops-alert", "ops-test"] : ["support", "ops-alert"],
      custom_fields: {
        ops_site_id: opsSiteId,
        ops_alert_id: alertId,
        is_support: true,
        ...(isTest ? { ops_test: true } : {}),
      },
      creation_source: "automation",
      creation_context: { source: "ops-site-alert", test: isTest },
    });
    if (taskErr) throw taskErr;

    // Notify team (same path as form / manual career-site requests)
    try {
      await supabase.rpc("fanout_new_request_notifications", {
        p_project_id: (project as any).id,
        p_title: finalTitle,
        p_group_key: "career_site",
        p_client_id: resolvedClientId,
        p_request_type: "careersite_bug",
        p_actor_id: null,
      });
    } catch (notifyErr) {
      console.error("fanout_new_request_notifications failed:", notifyErr);
    }

    await logAlertEvent(supabase, {
      event,
      ops_site_id: opsSiteId,
      alert_id: alertId,
      action: "created",
      project_id: (project as any).id,
      source,
      payload: body,
      ok: true,
    });

    return jsonResponse({
      ok: true,
      action: "created",
      project_id: (project as any).id,
      linked: !!projectId,
      source,
    });
  } catch (err) {
    console.error("ops-site-alert error", err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      await logAlertEvent(supabase, {
        event: (body?.event ?? "unknown").toLowerCase(),
        ops_site_id: body?.ops_site_id?.trim() || "unknown",
        alert_id: body?.alert_id?.trim() || null,
        action: "error",
        source,
        payload: body ?? {},
        ok: false,
        message,
      });
    } catch {
      /* ignore log failure */
    }
    return jsonResponse({ error: message }, 500);
  }
});

/**
 * Public intake API for /f/:slug.
 * Anonymous visitors have no session; all reads/writes go through the service role.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "task-attachments";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_EMAIL = 8;
const RATE_MAX_IP = 20;

const ALIASES: Record<string, string> = {
  careersite_bug: "careersite@hireclix.com",
  careersite_content: "careersite@hireclix.com",
  careersite_jobfeed: "careersite@hireclix.com",
  careersite_new_page: "careersite@hireclix.com",
  careersite_sow: "careersite@hireclix.com",
  careersite_support: "careersite@hireclix.com",
  careersite_update: "careersite@hireclix.com",
  web_edit: "web@hireclix.com",
  landing_page: "web@hireclix.com",
  banner_ads: "ads@hireclix.com",
  social: "ads@hireclix.com",
  email: "ads@hireclix.com",
  copywriting: "content@hireclix.com",
  job_description: "content@hireclix.com",
  infographic: "content@hireclix.com",
  recruiter_collateral: "creative@hireclix.com",
  event_collateral: "creative@hireclix.com",
  print_collateral: "creative@hireclix.com",
  swag_apparel: "creative@hireclix.com",
  video_edit: "media@hireclix.com",
  photo_retouch: "media@hireclix.com",
  presentation: "media@hireclix.com",
  brand_assets: "brand@hireclix.com",
  general: "requests@hireclix.com",
};

const FileSchema = z.object({
  name: z.string().min(1).max(300),
  type: z.string().max(200).optional(),
  dataBase64: z.string().min(1),
});

const LinkSchema = z.object({
  url: z.string().url().max(2000),
  label: z.string().max(300).optional().default(""),
});

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bootstrap"), slug: z.string().min(1).max(120) }),
  z.object({
    action: z.literal("submit"),
    slug: z.string().min(1).max(120),
    clientId: z.string().uuid(),
    requestedBy: z.string().uuid().nullable().optional(),
    submitterName: z.string().max(200).optional().default(""),
    submitterEmail: z.union([z.string().email(), z.literal("")]).optional(),
    title: z.string().max(300).optional().default(""),
    description: z.string().max(20000).optional().default(""),
    shipBy: z.string().max(32).nullable().optional(),
    requestType: z.string().max(80).nullable().optional(),
    requestTypeLabel: z.string().max(120).nullable().optional(),
    customFields: z.record(z.any()).optional().default({}),
    payload: z.record(z.any()).optional().default({}),
    files: z.array(FileSchema).max(MAX_FILES).optional().default([]),
    links: z.array(LinkSchema).max(20).optional().default([]),
  }),
]);

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function clientTag(name: string | null | undefined) {
  if (!name) return null;
  const slug = slugify(name);
  return slug ? `client:${slug}` : null;
}

function aliasFor(requestType: string | null | undefined) {
  if (!requestType) return "requests@hireclix.com";
  return ALIASES[requestType] ?? "requests@hireclix.com";
}

function requestRef(projectId?: string | null) {
  if (!projectId) return undefined;
  return `REQ-${projectId.slice(-6).toUpperCase()}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

async function hitRateLimit(key: string, max: number) {
  const now = Date.now();
  const { data } = await admin.from("public_form_rate_limits").select("*").eq("key", key).maybeSingle();
  if (!data) {
    await admin.from("public_form_rate_limits").insert({
      key,
      window_start: new Date().toISOString(),
      hit_count: 1,
    });
    return true;
  }
  const start = new Date(data.window_start).getTime();
  if (now - start > RATE_WINDOW_MS) {
    await admin.from("public_form_rate_limits").update({
      window_start: new Date().toISOString(),
      hit_count: 1,
    }).eq("key", key);
    return true;
  }
  if (data.hit_count >= max) return false;
  await admin.from("public_form_rate_limits").update({ hit_count: data.hit_count + 1 }).eq("key", key);
  return true;
}

async function loadForm(slug: string) {
  const { data: form, error } = await admin
    .from("pm_forms")
    .select("*")
    .eq("shareable_slug", slug)
    .maybeSingle();
  if (error) throw error;
  return form;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const input = parsed.data;

    if (input.action === "bootstrap") {
      const form = await loadForm(input.slug);
      if (!form) return json({ error: "form_not_found" }, 404);

      const [{ data: fields }, { data: clients }] = await Promise.all([
        admin.from("pm_form_fields").select("*").eq("form_id", form.id).order("sort_order"),
        admin.from("clients").select("id,name,is_internal").is("archived_at", null).order("name"),
      ]);

      return json({ form, fields: fields ?? [], clients: clients ?? [] });
    }

    const ip = clientIp(req);
    const emailKey = (input.submitterEmail || "").trim().toLowerCase();
    if (!(await hitRateLimit(`ip:${ip}`, RATE_MAX_IP))) {
      return json({ error: "rate_limited" }, 429);
    }
    if (emailKey && !(await hitRateLimit(`email:${emailKey}`, RATE_MAX_EMAIL))) {
      return json({ error: "rate_limited" }, 429);
    }

    const form = await loadForm(input.slug);
    if (!form) return json({ error: "form_not_found" }, 404);

    const { data: clientRow } = await admin
      .from("clients")
      .select("id,name,is_internal,archived_at")
      .eq("id", input.clientId)
      .maybeSingle();
    if (!clientRow || clientRow.archived_at) return json({ error: "invalid_client" }, 400);

    const title = (input.title || "").trim() || input.requestTypeLabel || form.name;
    const description = (input.description || "").trim() || null;
    const shipBy = input.shipBy || null;
    const requestedBy = input.requestedBy || null;
    const tags: string[] = [];
    const ct = clientTag(clientRow.name);
    if (ct) tags.push(ct);

    const { data: proj, error: pe } = await admin.from("pm_projects").insert({
      title,
      type: "quick_request",
      work_type: "request",
      status: "active",
      client_id: input.clientId,
      description,
      start_date: todayISO(),
      go_live_date: shipBy,
      created_by: requestedBy,
      requested_by: requestedBy,
      custom_fields: input.customFields ?? {},
      tags,
    }).select("id").single();
    if (pe || !proj) return json({ error: pe?.message || "project_insert_failed" }, 400);

    if (requestedBy) {
      await admin.from("pm_project_members").insert({
        project_id: proj.id, user_id: requestedBy, role: "requester",
      });
    }

    const { data: task, error: te } = await admin.from("pm_tasks").insert({
      project_id: proj.id,
      title,
      type: "design",
      status: "unclaimed",
      priority: "medium",
      duration_days: 1,
      due_date: shipBy,
      assignee_id: null,
      description,
    }).select("id").single();
    if (te) return json({ error: te.message || "task_insert_failed" }, 400);

    const failedFiles: string[] = [];
    for (const f of input.files) {
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(f.dataBase64), c => c.charCodeAt(0));
      } catch {
        failedFiles.push(f.name);
        continue;
      }
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        failedFiles.push(f.name);
        continue;
      }
      const path = `project/${proj.id}/${crypto.randomUUID()}-${f.name}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: f.type || "application/octet-stream",
      });
      if (upErr) {
        failedFiles.push(f.name);
        continue;
      }
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      const { error: insErr } = await admin.from("pm_project_attachments").insert({
        project_id: proj.id,
        type: "file",
        name: f.name,
        url: pub.publicUrl,
        file_size: bytes.byteLength,
        uploaded_by: requestedBy,
      });
      if (insErr) {
        await admin.storage.from(BUCKET).remove([path]);
        failedFiles.push(f.name);
      }
    }
    if (failedFiles.length) {
      return json({ error: `upload_failed: ${failedFiles.join(", ")}` }, 400);
    }

    if (input.links.length) {
      const { error: linkErr } = await admin.from("pm_project_links").insert(
        input.links.map(l => ({
          project_id: proj.id,
          url: l.url,
          label: l.label || null,
          created_by: requestedBy,
        })),
      );
      if (linkErr) return json({ error: "link_insert_failed" }, 400);
    }

    const { data: watchers } = await admin
      .from("pm_client_watchers")
      .select("user_id, request_type")
      .eq("client_id", input.clientId);
    const watcherIds = [...new Set(
      ((watchers ?? []) as { user_id: string; request_type: string | null }[])
        .filter(w => w.request_type == null || w.request_type === input.requestType)
        .map(w => w.user_id),
    )];
    if (watcherIds.length) {
      await admin.from("pm_project_members").upsert(
        watcherIds.map(user_id => ({ project_id: proj.id, user_id, role: "watcher" })),
        { onConflict: "project_id,user_id", ignoreDuplicates: true },
      );
    }

    const replyTo = aliasFor(input.requestType);
    let emailSent = false;
    let emailError: string | null = null;
    if (emailKey) {
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-request-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            kind: "received",
            to: emailKey,
            refId: requestRef(proj.id),
            title,
            requestType: input.requestTypeLabel || undefined,
            clientName: clientRow.name,
            projectId: proj.id,
            replyTo,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || (body && body.error)) {
          emailError = String(body?.error || `email_failed_${res.status}`);
        } else {
          emailSent = true;
        }
      } catch (e) {
        emailError = String((e as Error)?.message ?? e);
      }
    } else {
      emailError = "No recipient email";
    }

    await admin.from("pm_form_submissions").insert({
      form_id: form.id,
      payload: {
        request_type: input.requestType ?? null,
        title,
        description,
        ship_by: shipBy,
        client_id: input.clientId,
        ...(input.payload ?? {}),
      },
      submitter_name: input.submitterName || null,
      submitter_email: emailKey || null,
      created_project_id: proj.id,
      created_task_id: task?.id ?? null,
      received_emailed_at: emailSent ? new Date().toISOString() : null,
      received_email_error: emailSent ? null : (emailError ?? "unknown error").slice(0, 500),
    });

    return json({
      projectId: proj.id,
      taskId: task?.id ?? null,
      watcherIds,
      alias: replyTo,
      requestTypeLabel: input.requestTypeLabel ?? null,
      emailSent: emailSent && !!emailKey,
    });
  } catch (e) {
    console.error("public-form-api error:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

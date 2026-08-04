/**
 * PORTAL-6 mailer.
 *
 * Drains pending rows from `pm_portal_notifications` (emailed_at IS NULL),
 * resolves each recipient (portal contact or internal user), sends a branded
 * email via Resend and stamps `emailed_at` so nothing goes out twice.
 *
 * Call with `{}` to drain everything pending, or `{ notificationId }` to send
 * one specific row.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "HireClix Prioritize <prioritize@hireclix.com>";
const APP_URL = Deno.env.get("APP_URL") || "https://hireclix-prioritize.lovable.app";

const BodySchema = z.object({
  notificationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const colors = {
  primary: "#0f4c75",
  primaryLight: "#3282b8",
  text: "#1a1a2e",
  muted: "#64748b",
  bg: "#f8fafc",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KIND_HEADING: Record<string, string> = {
  portal_invite: "Your project portal is ready",
  comment_added: "New comment on your project",
  status_changed: "Project update",
  file_uploaded: "A new file was shared",
  request_completed: "Your request is complete",
  update_posted: "New message on your project",
};

function renderEmail(opts: {
  heading: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  projectTitle?: string | null;
}) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:24px;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 24px;text-align:center;background:linear-gradient(135deg,${colors.primary} 0%,${colors.primaryLight} 100%);">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${esc(opts.heading)}</h1>
    </div>
    <div style="padding:28px 24px;">
      ${opts.projectTitle ? `<h2 style="font-size:19px;margin:0 0 14px 0;color:${colors.text};">${esc(opts.projectTitle)}</h2>` : ""}
      <div style="background:${colors.bg};border-left:4px solid ${colors.primary};padding:14px 18px;border-radius:0 8px 8px 0;color:#475569;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(opts.message)}</div>
      <div style="text-align:center;">
        <a href="${opts.ctaUrl}" style="display:inline-block;margin:24px 0 0 0;background:${colors.primary};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600;font-size:15px;">${esc(opts.ctaLabel)} &rarr;</a>
      </div>
    </div>
    <div style="background:${colors.bg};padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6;">Automated message from <strong>HireClix Prioritize</strong>.<br>Reply to this email to reach the team.</p>
    </div>
  </div>
</body></html>`;
}

async function sendOne(n: any, apiKey: string): Promise<boolean> {
  let to: string | null = null;
  let ctaUrl = `${APP_URL}/pm`;
  let ctaLabel = "Open project";

  if (n.portal_access_id) {
    const { data: access } = await admin
      .from("pm_portal_access")
      .select("email, token, is_active")
      .eq("id", n.portal_access_id)
      .maybeSingle();
    if (!access || !access.is_active) return false;
    to = access.email;
    ctaUrl = `${APP_URL}/portal/${access.token}`;
    ctaLabel = n.kind === "portal_invite" ? "Open your portal" : "View the thread";
  } else if (n.user_id) {
    const { data: user } = await admin
      .from("mock_users")
      .select("email")
      .eq("id", n.user_id)
      .maybeSingle();
    to = user?.email ?? null;
    ctaUrl = n.project_id ? `${APP_URL}/pm/projects/${n.project_id}?tab=client` : `${APP_URL}/pm`;
    ctaLabel = "Open in Prioritize";
  }

  if (!to) return false;

  let projectTitle: string | null = null;
  if (n.project_id) {
    const { data: p } = await admin.from("pm_projects").select("title").eq("id", n.project_id).maybeSingle();
    projectTitle = p?.title ?? null;
  }

  const heading = KIND_HEADING[n.kind] ?? "Project update";
  const subject = n.subject || heading;
  const message =
    n.kind === "portal_invite"
      ? "You've been given access to your project portal. Use the button below to see progress, files and messages — no password needed. Keep this link private."
      : n.message || "There's a new update waiting for you.";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html: renderEmail({ heading, message, ctaLabel, ctaUrl, projectTitle }),
    }),
  });

  if (!res.ok) {
    console.error(`Resend send failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  return true;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = admin
      .from("pm_portal_notifications")
      .select("*")
      .is("emailed_at", null)
      .order("created_at", { ascending: true })
      .limit(parsed.data.limit ?? 25);
    if (parsed.data.notificationId) query = query.eq("id", parsed.data.notificationId);

    const { data: pending, error } = await query;
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    for (const n of pending ?? []) {
      const ok = await sendOne(n, apiKey).catch(e => {
        console.error("portal email failed", n.id, e);
        return false;
      });
      if (ok) sent++; else skipped++;
      // Stamp either way: a permanently undeliverable row shouldn't be retried forever.
      await admin
        .from("pm_portal_notifications")
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", n.id);
    }

    return new Response(JSON.stringify({ sent, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-portal-email error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

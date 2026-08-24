/**
 * Coworker notification mailer.
 *
 * Atomically claims pending pm_notifications rows, respects pm_notification_prefs.email
 * (default true), groups by user, and sends one Resend email per recipient.
 *
 * Call with `{}` to drain the queue, or `{ notificationId }` for an instant mention/assigned nudge.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "HireClix Prioritize <prioritize@product.hireclix.com>";
const REPLY_TO = "requests@hireclix.com";

const BodySchema = z.object({
  notificationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function resolveSecret(name: string): Promise<string | null> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const { data, error } = await admin.rpc("get_edge_secret", { secret_name: name });
  if (error) {
    console.error(`get_edge_secret(${name}) failed:`, error.message);
    return null;
  }
  return typeof data === "string" && data.length > 0 ? data : null;
}

const colors = {
  primary: "#0f4c75",
  primaryLight: "#3282b8",
  text: "#1a1a2e",
  muted: "#64748b",
  bg: "#f8fafc",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type NotifRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
};

function renderEmail(opts: {
  heading: string;
  items: { title: string; body: string | null; href: string }[];
  prefsUrl: string;
}) {
  const itemsHtml = opts.items
    .map((item) => {
      const body = item.body
        ? `<div style="color:#475569;font-size:14px;line-height:1.5;margin-top:6px;white-space:pre-wrap;">${esc(item.body)}</div>`
        : "";
      return `<div style="background:${colors.bg};border-left:4px solid ${colors.primary};padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 12px 0;">
        <a href="${esc(item.href)}" style="color:${colors.text};font-size:16px;font-weight:600;text-decoration:none;">${esc(item.title)}</a>
        ${body}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:24px;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 24px;text-align:center;background:linear-gradient(135deg,${colors.primary} 0%,${colors.primaryLight} 100%);">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${esc(opts.heading)}</h1>
    </div>
    <div style="padding:28px 24px;">
      ${itemsHtml}
      <div style="text-align:center;">
        <a href="${esc(opts.items[0]?.href ?? opts.prefsUrl)}" style="display:inline-block;margin:12px 0 0 0;background:${colors.primary};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600;font-size:15px;">Open in Prioritize &rarr;</a>
      </div>
    </div>
    <div style="background:${colors.bg};padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6;">Automated message from <strong>HireClix Prioritize</strong>.<br>
      <a href="${esc(opts.prefsUrl)}" style="color:${colors.primaryLight};">Manage notification preferences</a></p>
    </div>
  </div>
</body></html>`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = await resolveSecret("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const appUrl = (await resolveSecret("APP_URL")) || "https://prioritize.hireclix.com";
    const prefsUrl = `${appUrl.replace(/\/+$/, "")}/pm/settings/notifications`;

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claimed, error: claimErr } = await admin.rpc("claim_pm_notification_emails", {
      p_notification_id: parsed.data.notificationId ?? null,
      p_limit: parsed.data.limit ?? 50,
    });
    if (claimErr) throw claimErr;

    const rows = (claimed ?? []) as NotifRow[];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: users } = await admin.from("pm_users").select("id, email").in("id", userIds);
    const emailByUser = new Map((users ?? []).map((u: { id: string; email: string | null }) => [u.id, u.email]));

    const { data: prefRows } = await admin
      .from("pm_notification_prefs")
      .select("user_id, event_type, email")
      .in("user_id", userIds);
    const prefOff = new Set(
      (prefRows ?? [])
        .filter((p: { email: boolean }) => p.email === false)
        .map((p: { user_id: string; event_type: string }) => `${p.user_id}|${p.event_type}`),
    );

    const byUser = new Map<string, NotifRow[]>();
    let skipped = 0;
    for (const n of rows) {
      if (prefOff.has(`${n.user_id}|${n.type}`)) {
        skipped++;
        continue;
      }
      const list = byUser.get(n.user_id) ?? [];
      list.push(n);
      byUser.set(n.user_id, list);
    }

    let sent = 0;
    for (const [userId, items] of byUser) {
      const to = emailByUser.get(userId);
      if (!to) {
        skipped += items.length;
        await admin
          .from("pm_notifications")
          .update({ email_error: "No email on pm_users row" })
          .in("id", items.map((i) => i.id));
        continue;
      }

      const heading = items.length === 1 ? items[0].title : `${items.length} new updates in Prioritize`;
      const subject = items.length === 1 ? items[0].title : `${items.length} new updates in Prioritize`;
      const html = renderEmail({
        heading,
        prefsUrl,
        items: items.map((n) => ({
          title: n.title,
          body: n.body,
          href: `${appUrl.replace(/\/+$/, "")}${n.link || "/pm"}`,
        })),
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          reply_to: REPLY_TO,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Resend send failed [${res.status}]: ${errText}`);
        skipped += items.length;
        await admin
          .from("pm_notifications")
          .update({ email_error: `Resend ${res.status}: ${errText.slice(0, 500)}` })
          .in("id", items.map((i) => i.id));
        continue;
      }
      sent++;
    }

    return new Response(JSON.stringify({ sent, skipped, claimed: rows.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-notification-email error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

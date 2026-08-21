import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "HireClix Prioritize <prioritize@hireclix.com>";
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:8080";

const BodySchema = z.object({
  kind: z.enum(["received", "completed"]),
  to: z.string().email(),
  refId: z.string().max(64).optional(),
  title: z.string().max(300).optional(),
  requestType: z.string().max(120).optional(),
  clientName: z.string().max(200).optional(),
  projectId: z.string().max(64).optional(),
});

const colors = {
  primary: "#0f4c75",
  primaryLight: "#3282b8",
  success: "#059669",
  text: "#1a1a2e",
  muted: "#64748b",
  bg: "#f8fafc",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function row(label: string, value?: string | null) {
  if (!value) return "";
  return `<tr><td style="padding:6px 0;">
    <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:${colors.muted};">${esc(label)}</div>
    <div style="font-size:15px;color:${colors.text};">${esc(value)}</div>
  </td></tr>`;
}

function renderEmail(b: z.infer<typeof BodySchema>) {
  const done = b.kind === "completed";
  const heading = done ? "Your request is complete" : "We've got your request";
  const intro = done
    ? `Your request <strong>${esc(b.title || "")}</strong> has been completed. If anything still looks off, just reply to this email and we'll pick it back up.`
    : `Thanks for submitting your request. Our team has it in the queue and will follow up with next steps. Keep the reference number below handy.`;
  const accent = done ? colors.success : colors.primary;
  const link = b.projectId ? `${APP_URL}/pm/projects/${b.projectId}` : `${APP_URL}/pm`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:24px;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 24px;text-align:center;background:linear-gradient(135deg,${accent} 0%,${colors.primaryLight} 100%);">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${esc(heading)}</h1>
    </div>
    <div style="padding:28px 24px;">
      ${b.title ? `<h2 style="font-size:19px;margin:0 0 14px 0;color:${colors.text};">${esc(b.title)}</h2>` : ""}
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px 0;">${intro}</p>
      <div style="background:${colors.bg};border-left:4px solid ${accent};padding:12px 18px;border-radius:0 8px 8px 0;">
        <table style="width:100%;border-collapse:collapse;">
          ${row("Reference", b.refId)}
          ${row("Request type", b.requestType)}
          ${row("Client", b.clientName)}
          ${row(done ? "Completed" : "Submitted", new Date().toLocaleDateString("en-US"))}
        </table>
      </div>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;margin:24px 0 0 0;background:${accent};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600;font-size:15px;">View request &rarr;</a>
      </div>
    </div>
    <div style="background:${colors.bg};padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6;">Automated message from <strong>HireClix Prioritize</strong>.<br>Reply to this email to reach the team.</p>
    </div>
  </div>
</body></html>`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;

    const subject = body.kind === "completed"
      ? `Your request ${body.title ? `"${body.title}" ` : ""}has been completed`
      : `We received your request${body.refId ? ` (${body.refId})` : ""}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: FROM, to: [body.to], subject, html: renderEmail(body) }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`Resend send failed [${res.status}]: ${text}`);
      return new Response(JSON.stringify({ error: "Provider request failed", status: res.status, details: text }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sent ${body.kind} email to ${body.to}`);
    return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-request-email error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

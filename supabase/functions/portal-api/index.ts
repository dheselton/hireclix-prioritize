/**
 * PORTAL-4: public client-portal API.
 *
 * The external portal (`/portal/:token`) has no Supabase session, so every read
 * and write funnels through this service-role function. The magic-link token in
 * `pm_portal_access` is the only credential; every action re-validates it and
 * scopes data to that row's client.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "portal-attachments";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const AttachmentSchema = z.object({
  name: z.string().min(1).max(300),
  path: z.string().min(1).max(500),
  size: z.number().nonnegative().optional(),
  type: z.string().max(200).optional(),
});

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bootstrap"), token: z.string().uuid() }),
  z.object({ action: z.literal("project"), token: z.string().uuid(), projectId: z.string().uuid() }),
  z.object({
    action: z.literal("post_message"),
    token: z.string().uuid(),
    projectId: z.string().uuid(),
    body: z.string().min(1).max(10000),
    attachments: z.array(AttachmentSchema).max(10).optional(),
  }),
  z.object({ action: z.literal("sign"), token: z.string().uuid(), path: z.string().min(1).max(500) }),
  z.object({
    action: z.literal("upload"),
    token: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string().min(1).max(300),
    type: z.string().max(200).optional(),
    dataBase64: z.string().min(1),
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

async function resolveAccess(token: string) {
  const { data, error } = await admin
    .from("pm_portal_access")
    .select("id, token, email, label, client_id, is_active")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  return data;
}

/** Portal visitors may only touch projects belonging to their client. */
async function assertProject(clientId: string | null, projectId: string) {
  const { data } = await admin
    .from("pm_projects")
    .select("id, title, status, type, work_type, start_date, kickoff_date, go_live_date, description, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  if (!clientId || data.client_id !== clientId) return null;
  return data;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const input = parsed.data;

    const access = await resolveAccess(input.token);
    if (!access) return json({ error: "invalid_token" }, 401);

    // Best-effort access stamp; never blocks the response.
    admin
      .from("pm_portal_access")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", access.id)
      .then(() => {}, () => {});

    if (input.action === "bootstrap") {
      let clientName: string | null = null;
      if (access.client_id) {
        const { data: c } = await admin.from("clients").select("name").eq("id", access.client_id).maybeSingle();
        clientName = c?.name ?? null;
      }

      const { data: projects } = await admin
        .from("pm_projects")
        .select("id, title, status, type, work_type, go_live_date, start_date, kickoff_date")
        .eq("client_id", access.client_id ?? "00000000-0000-0000-0000-000000000000")
        .order("created_at", { ascending: false });

      const ids = (projects ?? []).map(p => p.id);
      const counts: Record<string, { open: number; done: number; total: number }> = {};
      if (ids.length) {
        const { data: tasks } = await admin
          .from("pm_tasks")
          .select("project_id, status")
          .in("project_id", ids);
        for (const t of tasks ?? []) {
          const c = (counts[t.project_id] ??= { open: 0, done: 0, total: 0 });
          c.total += 1;
          if (t.status === "complete" || t.status === "approved") c.done += 1;
          else c.open += 1;
        }
      }

      return json({
        access: { label: access.label, email: access.email, clientId: access.client_id, clientName },
        projects: (projects ?? []).map(p => ({ ...p, counts: counts[p.id] ?? { open: 0, done: 0, total: 0 } })),
      });
    }

    if (input.action === "sign") {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(input.path, 600);
      if (error) return json({ error: "sign_failed" }, 400);
      return json({ url: data?.signedUrl ?? null });
    }

    const project = await assertProject(access.client_id, (input as { projectId: string }).projectId);
    if (!project) return json({ error: "not_found" }, 404);

    if (input.action === "project") {
      const { data: tasks } = await admin
        .from("pm_tasks")
        .select("id, title, status, type, due_date, start_date, needs_client_update, phase_id, sort_order")
        .eq("project_id", project.id)
        .order("sort_order", { ascending: true });

      const { data: phases } = await admin
        .from("pm_project_phases")
        .select("id, name, sort_order")
        .eq("project_id", project.id)
        .order("sort_order", { ascending: true });

      const { data: messages } = await admin
        .from("pm_portal_messages")
        .select("id, project_id, author_user_id, author_portal_id, author_name, body, attachments, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true });

      return json({ project, phases: phases ?? [], tasks: tasks ?? [], messages: messages ?? [] });
    }

    if (input.action === "upload") {
      const bytes = Uint8Array.from(atob(input.dataBase64), c => c.charCodeAt(0));
      if (bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 413);
      const path = `project/${project.id}/${crypto.randomUUID()}-${input.name}`;
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: input.type || "application/octet-stream",
      });
      if (error) return json({ error: "upload_failed" }, 400);
      return json({ attachment: { name: input.name, path, size: bytes.byteLength, type: input.type ?? null } });
    }

    if (input.action === "post_message") {
      const { data, error } = await admin
        .from("pm_portal_messages")
        .insert({
          project_id: project.id,
          body: input.body,
          author_name: access.label || access.email,
          author_portal_id: access.id,
          attachments: input.attachments ?? [],
        })
        .select("id, project_id, author_user_id, author_portal_id, author_name, body, attachments, created_at")
        .single();
      if (error) return json({ error: "insert_failed" }, 400);

      await admin.from("pm_portal_notifications").insert({
        portal_access_id: access.id,
        kind: "portal_message",
        project_id: project.id,
        subject: `New client message on ${project.title}`,
        message: input.body.slice(0, 500),
      });

      return json({ message: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("portal-api error:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

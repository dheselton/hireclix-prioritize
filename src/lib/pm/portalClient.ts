/**
 * PORTAL-4 client for the public `/portal/:token` experience.
 *
 * Nothing here talks to the database directly — the external visitor has no
 * session, so every call goes through the `portal-api` edge function which
 * validates the token with the service role.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PortalAccessInfo {
  label: string | null;
  email: string;
  clientId: string | null;
  clientName: string | null;
}

export interface PortalProjectSummary {
  id: string;
  title: string;
  status: string;
  type: string | null;
  work_type: string | null;
  go_live_date: string | null;
  start_date: string | null;
  kickoff_date: string | null;
  counts: { open: number; done: number; total: number };
}

export interface PortalTask {
  id: string;
  title: string;
  status: string;
  type: string | null;
  due_date: string | null;
  start_date: string | null;
  needs_client_update: boolean | null;
  phase_id: string | null;
}

export interface PortalPhase {
  id: string;
  name: string;
  sort_order: number;
}

export interface PortalMsg {
  id: string;
  project_id: string;
  author_user_id: string | null;
  author_portal_id: string | null;
  author_name: string;
  body: string;
  attachments: { name: string; path: string; size?: number; type?: string }[];
  created_at: string;
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("portal-api", { body: payload });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in (data as any)) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

export function portalBootstrap(token: string) {
  return call<{ access: PortalAccessInfo; projects: PortalProjectSummary[] }>({ action: "bootstrap", token });
}

export function portalProject(token: string, projectId: string) {
  return call<{
    project: Record<string, any>;
    phases: PortalPhase[];
    tasks: PortalTask[];
    messages: PortalMsg[];
  }>({ action: "project", token, projectId });
}

export function portalPostMessage(
  token: string,
  projectId: string,
  body: string,
  attachments?: { name: string; path: string; size?: number; type?: string }[],
) {
  return call<{ message: PortalMsg }>({ action: "post_message", token, projectId, body, attachments });
}

export async function portalSignedUrl(token: string, path: string) {
  const res = await call<{ url: string | null }>({ action: "sign", token, path });
  return res.url;
}

/** Uploads go through the function as base64 since the bucket is private. */
export async function portalUpload(token: string, projectId: string, file: File) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  const res = await call<{ attachment: { name: string; path: string; size?: number; type?: string } }>({
    action: "upload",
    token,
    projectId,
    name: file.name,
    type: file.type,
    dataBase64: btoa(binary),
  });
  return res.attachment;
}

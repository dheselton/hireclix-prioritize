import { supabase } from "@/integrations/supabase/client";

/** REQ-xxxxxx reference shown to submitters (same shape as SubmissionSuccess). */
export function requestRef(projectId?: string | null): string | undefined {
  if (!projectId) return undefined;
  return `REQ-${projectId.slice(-6).toUpperCase()}`;
}

export type SendRequestEmailResult = { ok: boolean; error?: string };

/**
 * Fire-and-forget "we received your request" email to the submitter.
 * Never throws — an email failure must not break intake submission.
 * Returns ok/error so callers can toast and audit the outcome on insert.
 */
export async function sendRequestReceivedEmail(args: {
  to?: string | null;
  title?: string | null;
  requestTypeLabel?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  /** Per-type inbox (e.g. careersite@hireclix.com) used as Reply-To. */
  replyTo?: string | null;
}): Promise<SendRequestEmailResult> {
  if (!args.to) return { ok: false, error: "No recipient email" };
  try {
    const { data, error } = await supabase.functions.invoke("send-request-email", {
      body: {
        kind: "received",
        to: args.to,
        refId: requestRef(args.projectId),
        title: args.title || undefined,
        requestType: args.requestTypeLabel || undefined,
        clientName: args.clientName || undefined,
        projectId: args.projectId || undefined,
        replyTo: args.replyTo || undefined,
      },
    });
    if (error) {
      const message = error.message || "send-request-email failed";
      console.error("send-request-email (received) failed:", error);
      return { ok: false, error: message };
    }
    // Edge function may return 4xx/5xx with a JSON body and no FunctionsHttpError
    // depending on supabase-js version — surface that too.
    if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
      const message = String((data as { error: unknown }).error);
      console.error("send-request-email (received) failed:", message);
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("send-request-email (received) failed:", e);
    return { ok: false, error: message };
  }
}

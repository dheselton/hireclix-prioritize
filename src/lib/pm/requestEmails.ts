import { supabase } from "@/integrations/supabase/client";

/** REQ-xxxxxx reference shown to submitters (same shape as SubmissionSuccess). */
export function requestRef(projectId?: string | null): string | undefined {
  if (!projectId) return undefined;
  return `REQ-${projectId.slice(-6).toUpperCase()}`;
}

/**
 * Fire-and-forget "we received your request" email to the submitter.
 * Never throws — an email failure must not break intake submission.
 */
export async function sendRequestReceivedEmail(args: {
  to?: string | null;
  title?: string | null;
  requestTypeLabel?: string | null;
  clientName?: string | null;
  projectId?: string | null;
}): Promise<void> {
  if (!args.to) return;
  try {
    const { error } = await supabase.functions.invoke("send-request-email", {
      body: {
        kind: "received",
        to: args.to,
        refId: requestRef(args.projectId),
        title: args.title || undefined,
        requestType: args.requestTypeLabel || undefined,
        clientName: args.clientName || undefined,
        projectId: args.projectId || undefined,
      },
    });
    if (error) console.error("send-request-email (received) failed:", error);
  } catch (e) {
    console.error("send-request-email (received) failed:", e);
  }
}

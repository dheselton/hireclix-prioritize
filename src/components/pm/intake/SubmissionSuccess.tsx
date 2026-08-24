import { CheckCircle2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AvatarStack } from "@/components/pm/AvatarStack";

interface Props {
  title?: string;
  message?: string;
  /** Display label for the request type (e.g. "Career site · Bug fix"). */
  requestTypeLabel?: string | null;
  /** Created project id — last 6 chars are shown as a friendly ref. */
  projectId?: string | null;
  watcherIds?: string[];
  /** Reply-To alias for the confirmation email (e.g. careersite@hireclix.com). */
  confirmationAlias: string;
  /** Whether the confirmation email was handed off successfully. null hides the email note. */
  emailSent?: boolean | null;
  children?: React.ReactNode;
}

/**
 * Shared confirmation panel for intake flows (in-app dialog + public form).
 * Inherits all styling from existing tokens and components.
 */
export function SubmissionSuccess({
  title = "Request received",
  message = "Your request was added to the queue. The right team will pick it up shortly.",
  requestTypeLabel,
  projectId,
  watcherIds = [],
  confirmationAlias,
  emailSent = true,
  children,
}: Props) {
  const ref = projectId ? `REQ-${projectId.slice(-6).toUpperCase()}` : null;
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
          {ref && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs">{ref}</span>
            </div>
          )}
          {requestTypeLabel && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Request type</span>
              <span className="font-medium">{requestTypeLabel}</span>
            </div>
          )}
          {watcherIds.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Watchers notified</span>
              <AvatarStack userIds={watcherIds} max={4} size="xs" />
            </div>
          )}
        </div>

        {emailSent !== null && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground italic">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {emailSent ? (
                <>
                  A confirmation email was sent to you. Replies go to{" "}
                  <span className="font-mono not-italic">{confirmationAlias}</span>.
                </>
              ) : (
                <>
                  We couldn&apos;t send the confirmation email right now. Questions? Reach us at{" "}
                  <span className="font-mono not-italic">{confirmationAlias}</span>.
                </>
              )}
            </span>
          </div>
        )}

        {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
      </CardContent>
    </Card>
  );
}

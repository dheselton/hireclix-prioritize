import { Headphones, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import {
  dismissSupportPrompt,
  useEnterSupportMode,
  useShouldPromptSupport,
} from "@/lib/pm/supportMode";
import type { PmProject } from "@/types/pm";
import { useState } from "react";

/**
 * Auto-prompt PMs to transition a career-site project into Support mode
 * once its go-live date has arrived. Visible to PM / BA roles only.
 */
export function SupportReadyBanner({ project }: { project: PmProject }) {
  const { user } = useCurrentUser();
  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const canFlip = roles.some((r) => r === "pm" || r === "ba");
  const show = useShouldPromptSupport(project);
  const { enter, busy } = useEnterSupportMode(project);
  const [dismissed, setDismissed] = useState(false);

  if (!canFlip || !show || dismissed) return null;

  const wentLive = project.go_live_date ? fmtDate(project.go_live_date) : null;

  return (
    <div className="rounded-lg border border-info/40 bg-info/10 px-4 py-3 flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-info/20 p-1.5 text-info">
        <Headphones className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">
          Ready to transition to Support mode?
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {wentLive
            ? <>This career-site project went live on <span className="font-medium text-foreground">{wentLive}</span>. Flip it into Support to archive the build tasks and unlock the Documentation tab.</>
            : <>This career-site project has reached its go-live date. Flip it into Support to archive the build tasks and unlock the Documentation tab.</>
          }
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={enter} disabled={busy}>
          <Headphones className="h-4 w-4 mr-1" />
          {busy ? "Entering…" : "Enter Support mode"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { dismissSupportPrompt(project.id); setDismissed(true); }}
          aria-label="Dismiss for 7 days"
          title="Not yet — remind me later"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import { Headphones, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import {
  dismissSupportPrompt,
  useEnterSupportMode,
  useShouldPromptSupport,
} from "@/lib/pm/supportMode";
import { openBuildTasks } from "@/lib/pm/supportHandoff";
import { SupportHandoffDialog } from "@/components/pm/project/SupportHandoffDialog";
import type { PmProject, PmTask } from "@/types/pm";
import { useState } from "react";

/**
 * Auto-prompt PMs to transition a career-site project into Support mode
 * once its go-live date has arrived. Visible to PM / BA roles only.
 */
export function SupportReadyBanner({
  project,
  tasks = [],
}: {
  project: PmProject;
  tasks?: PmTask[];
}) {
  const { user } = useCurrentUser();
  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const canFlip = roles.some((r) => r === "pm" || r === "ba");
  const show = useShouldPromptSupport(project);
  const { enter, busy } = useEnterSupportMode(project);
  const [dismissed, setDismissed] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  if (!canFlip || !show || dismissed) return null;

  const wentLive = project.go_live_date ? fmtDate(project.go_live_date) : null;
  const openCount = openBuildTasks(tasks).length;

  async function onEnterClick() {
    if (openCount > 0) {
      setHandoffOpen(true);
      return;
    }
    await enter();
  }

  return (
    <>
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
              ? <>This career-site project went live on <span className="font-medium text-foreground">{wentLive}</span>. Flip it into Support{openCount > 0 ? ` and hand off ${openCount} open build task${openCount === 1 ? "" : "s"}` : ""} to unlock the Documentation tab and Live Career Sites inventory.</>
              : <>This career-site project has reached its go-live date. Flip it into Support{openCount > 0 ? ` and hand off ${openCount} open build task${openCount === 1 ? "" : "s"}` : ""}.</>
            }
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => void onEnterClick()} disabled={busy}>
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

      <SupportHandoffDialog
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
        project={project}
        tasks={tasks}
        enterSupportMode
      />
    </>
  );
}

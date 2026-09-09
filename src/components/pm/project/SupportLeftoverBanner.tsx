import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { isInSupportMode } from "@/lib/pm/liveSites";
import { openBuildTasks } from "@/lib/pm/supportHandoff";
import { SupportHandoffDialog } from "@/components/pm/project/SupportHandoffDialog";
import type { PmProject, PmTask } from "@/types/pm";

/**
 * Already-live sites with leftover open build tasks — offer the same handoff
 * dialog without re-stamping Support mode.
 */
export function SupportLeftoverBanner({
  project,
  tasks,
}: {
  project: PmProject;
  tasks: PmTask[];
}) {
  const { roles } = useCurrentUser();
  const canFlip = roles.some((r) => r === "pm" || r === "ba");
  const [open, setOpen] = useState(false);

  if (!canFlip || !isInSupportMode(project)) return null;
  const openCount = openBuildTasks(tasks).length;
  if (openCount === 0) return null;

  return (
    <>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-amber-500/20 p-1.5 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            {openCount} open build task{openCount === 1 ? "" : "s"} still on this live site
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Complete them, convert to Support requests, or keep them open. Live sites stay out of
            All Work project cards either way.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Review handoff
        </Button>
      </div>

      <SupportHandoffDialog
        open={open}
        onOpenChange={setOpen}
        project={project}
        tasks={tasks}
        enterSupportMode={false}
      />
    </>
  );
}

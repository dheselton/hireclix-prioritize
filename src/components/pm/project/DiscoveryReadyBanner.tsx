import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { getGroupsAwaitingPages, getDefinePagesTask, type AwaitingGroup } from "@/lib/pm/pageGroups";
import { useMockUsers } from "@/lib/pm/mockUser";
import { Link } from "react-router-dom";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmTask } from "@/types/pm";

/**
 * Shown on ProjectDetail when a page group's discovery task is complete but
 * no real pages have been stamped for it yet. Nudges the PM to define pages
 * (mid-flight) instead of leaving reservations sitting idle.
 * Dismissal is per-project-per-session.
 */
export function DiscoveryReadyBanner({
  projectId,
  templateId,
  tasks,
  onDefinePages,
}: {
  projectId: string;
  templateId: string | null;
  tasks: PmTask[];
  onDefinePages: () => void;
}) {
  const [awaiting, setAwaiting] = useState<AwaitingGroup[]>([]);
  const [defineTask, setDefineTask] = useState<any>(null);
  const { users } = useMockUsers();
  const dismissKey = `pm.discoveryBannerDismissed.${projectId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });

  const reload = async () => {
    if (!templateId) { setAwaiting([]); return; }
    const [a, dt] = await Promise.all([
      getGroupsAwaitingPages(projectId, templateId, tasks as any),
      getDefinePagesTask(projectId),
    ]);
    setAwaiting(a);
    setDefineTask(dt);
  };
  useEffect(() => { reload(); }, [projectId, templateId, tasks]);
  useTasksChanged(reload);

  if (dismissed || !awaiting.length) return null;
  const names = awaiting.map(a => a.group.name).join(", ");
  const owner = defineTask?.assignee_id ? users.find(u => u.id === defineTask.assignee_id) : null;

  return (
    <div className="rounded-md border border-amber-500/60 bg-amber-500/5 p-3 flex items-start gap-3">
      <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Discovery complete — define pages for {names}</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reserved time is holding the schedule and all page work is blocked until pages are defined.
          {owner ? ` Owned by ${owner.name}` : " No owner yet"}
          {defineTask ? (
            <>
              {" · "}
              <Link to={`/pm/tasks/${defineTask.id}`} className="underline hover:text-foreground">
                Open the Define pages task
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <Button size="sm" onClick={onDefinePages}>Define pages</Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          try { sessionStorage.setItem(dismissKey, "1"); } catch {}
          setDismissed(true);
        }}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

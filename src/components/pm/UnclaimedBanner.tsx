import { useEffect, useMemo, useState } from "react";
import { Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { buildQueueLink } from "@/lib/pm/links";
import { useTasksChanged } from "@/lib/pm/refresh";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { teamForRole, teamForTask, TEAM_LABEL } from "@/lib/pm/track";
import { useMeMode } from "@/hooks/useMeMode";
import type { PmTask, PmProject } from "@/types/pm";

interface Props {
  /** Limit to a single project (used on ProjectDetail). */
  projectId?: string;
  /** Hide the "View →" button (Work Queue is already the queue). */
  hideCta?: boolean;
}

/**
 * Sticky top banner that appears when there are unclaimed tasks in the current
 * user's team lane. PMs see all teams and can switch via the Work Queue page.
 * Dismiss is per-session and resets when the count grows.
 */
export function UnclaimedBanner({ projectId, hideCta = false }: Props) {
  const { user, role } = useCurrentUser();
  const { isMe } = useMeMode();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [dismissedAt, setDismissedAt] = useState<number>(0);

  const reload = async () => {
    const [t, p] = await Promise.all([
      fetchTasks(projectId),
      projectId ? Promise.resolve([] as PmProject[]) : fetchProjects(),
    ]);
    setTasks(t);
    setProjects(p);
  };
  useEffect(() => { reload(); }, [projectId]);
  useTasksChanged(reload);

  const myTeam = useMemo(() => teamForRole(role), [role]);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const unclaimed = useMemo(() => {
    return tasks.filter(t => {
      if (t.status !== "unclaimed") return false;
      // In global views, only surface unclaimed quick tasks — project tasks
      // can legitimately sit unclaimed for a while and should not spam the banner.
      if (!projectId) {
        const p = projById.get(t.project_id);
        if ((p as any)?.work_type !== "request") return false;
      }
      // In "All" mode everyone sees every team's unclaimed work.
      if (!isMe || role === "pm") return true;
      return teamForTask(t) === myTeam;
    });
  }, [tasks, role, myTeam, isMe, projectId, projById]);

  if (!unclaimed.length || unclaimed.length <= dismissedAt) return null;

  const teamLabel = (!isMe || role === "pm") ? "team" : TEAM_LABEL[myTeam].toLowerCase();
  const sessKey = `pm.unclaimedBanner.dismissed.${user?.id ?? "anon"}`;
  const queueLink = projectId
    ? `/pm/projects/${projectId}`
    : buildQueueLink({ chips: ["unclaimed"], workType: "request" });

  const noun = projectId ? "task" : "quick task";

  return (
    <div className="sticky top-0 z-30 -mx-6 -mt-6 mb-2 px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/40 backdrop-blur">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <Link to={queueLink} className="flex items-center gap-2.5 text-sm flex-1 hover:underline underline-offset-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white unclaimed-pulse">
            <Inbox className="h-3.5 w-3.5" />
          </span>
          <span>
            <strong>{unclaimed.length}</strong>{" "}
            unclaimed {teamLabel} {unclaimed.length === 1 ? noun : `${noun}s`} waiting to be grabbed.
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {!hideCta && (
            <Button asChild size="sm" variant="outline" className="h-7">
              <Link to={queueLink}>View queue →</Link>
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              setDismissedAt(unclaimed.length);
              try { sessionStorage.setItem(sessKey, String(unclaimed.length)); } catch {}
            }}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

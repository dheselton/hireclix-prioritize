import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Ban, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isHardOverdue } from "@/lib/pm/dueState";
import type { PmProject, PmTask } from "@/types/pm";

interface Props {
  projects: PmProject[];
  tasks: PmTask[];
  projectIds: Set<string>;
}

function isActive(t: PmTask) { return t.status !== "complete" && t.status !== "approved"; }

/**
 * PM-only health roll-up: for each of "my" projects (where I'm the PM),
 * show overdue / blocked / active counts. Each row deep-links to project detail.
 */
export function ProjectHealthList({ projects, tasks, projectIds }: Props) {
  const rows = useMemo(() => {
    const byProj = new Map<string, PmTask[]>();
    for (const t of tasks) {
      if (!projectIds.size || projectIds.has(t.project_id)) {
        const arr = byProj.get(t.project_id) ?? [];
        arr.push(t);
        byProj.set(t.project_id, arr);
      }
    }
    return projects
      .filter(p => (!projectIds.size || projectIds.has(p.id)) && p.status !== "complete" && p.status !== "archived")
      .map(p => {
        const ts = byProj.get(p.id) ?? [];
        let overdue = 0, blocked = 0, active = 0, inReview = 0;
        for (const t of ts) {
          if (!isActive(t)) continue;
          active++;
          if (t.status === "blocked") blocked++;
          else if (isHardOverdue(t)) overdue++;
          if (t.status === "in_review") inReview++;
        }
        const health: "overdue" | "at_risk" | "on_track" =
          overdue > 0 ? "overdue" : blocked > 0 ? "at_risk" : "on_track";
        return { project: p, overdue, blocked, active, inReview, health };
      })
      .sort((a, b) => {
        const r = { overdue: 0, at_risk: 1, on_track: 2 } as const;
        if (r[a.health] !== r[b.health]) return r[a.health] - r[b.health];
        return a.project.title.localeCompare(b.project.title);
      });
  }, [projects, tasks, projectIds]);

  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed rounded-md">
        No active projects assigned to you.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map(({ project, overdue, blocked, active, inReview, health }) => (
        <Link key={project.id} to={`/pm/projects/${project.id}`} className="block">
          <Card className="hover:shadow-md hover:border-foreground/20 transition">
            <CardContent className="p-3 flex items-center gap-3">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  health === "overdue" && "bg-red-500",
                  health === "at_risk" && "bg-amber-500",
                  health === "on_track" && "bg-emerald-500",
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{project.title}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-0.5">
                  {overdue > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                      <AlertTriangle className="h-3 w-3" /> {overdue} overdue
                    </span>
                  )}
                  {blocked > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Ban className="h-3 w-3" /> {blocked} blocked
                    </span>
                  )}
                  {inReview > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {inReview} in review
                    </span>
                  )}
                  <span>{active} active</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

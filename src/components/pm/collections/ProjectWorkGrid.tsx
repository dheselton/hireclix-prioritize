import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectWorkCard } from "./ProjectWorkCard";
import { TaskListView } from "./TaskListView";
import type { PmProject, PmTask } from "@/types/pm";

interface Props {
  tasks: PmTask[];
  projects: Map<string, PmProject>;
  meId: string | null;
  onOpenTask: (id: string) => void;
  onChanged?: () => void;
  /** When true, loose tasks group is omitted (e.g. for unclaimed-only sections you want loose to bubble first elsewhere). */
  hideLoose?: boolean;
}

function isActive(t: PmTask) { return t.status !== "complete" && t.status !== "approved"; }

function healthRank(tasks: PmTask[]) {
  const today = new Date(new Date().toDateString());
  let overdue = 0, blocked = 0;
  for (const t of tasks) {
    if (!isActive(t)) continue;
    if (t.status === "blocked") blocked++;
    else if (t.due_date && new Date(t.due_date) < today) overdue++;
  }
  if (overdue > 0) return 0;
  if (blocked > 0) return 1;
  if (tasks.some(isActive)) return 2;
  return 3;
}

export function ProjectWorkGrid({ tasks, projects, meId, onOpenTask, onChanged, hideLoose }: Props) {
  const navigate = useNavigate();
  const [showLoose, setShowLoose] = useState(true);

  const groups = useMemo(() => {
    const byProj = new Map<string, PmTask[]>();
    const loose: PmTask[] = [];
    for (const t of tasks) {
      if (!t.project_id || !projects.get(t.project_id)) {
        loose.push(t);
      } else {
        const arr = byProj.get(t.project_id) ?? [];
        arr.push(t);
        byProj.set(t.project_id, arr);
      }
    }
    const list = Array.from(byProj.entries())
      .map(([pid, ts]) => ({ project: projects.get(pid)!, tasks: ts }))
      .sort((a, b) => healthRank(a.tasks) - healthRank(b.tasks) || a.project.title.localeCompare(b.project.title));
    return { list, loose };
  }, [tasks, projects]);

  const isEmpty = groups.list.length === 0 && groups.loose.length === 0;
  if (isEmpty) {
    return <div className="text-sm text-muted-foreground italic py-6 text-center border border-dashed rounded-md">Nothing matches these filters.</div>;
  }

  return (
    <div className="space-y-4">
      {groups.list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.list.map(g => (
            <ProjectWorkCard
              key={g.project.id}
              project={g.project}
              tasks={g.tasks}
              meId={meId}
              onOpenTask={onOpenTask}
              onOpenProject={(id) => navigate(`/pm/projects/${id}`)}
            />
          ))}
        </div>
      )}

      {!hideLoose && groups.loose.length > 0 && (
        <div className="border border-dashed border-amber-400/40 rounded-md">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/30"
            onClick={() => setShowLoose(v => !v)}
          >
            <span className="inline-flex items-center gap-2">
              {showLoose ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Loose tasks (no project)
              <span className="text-muted-foreground font-normal">({groups.loose.length})</span>
            </span>
          </button>
          {showLoose && (
            <div className="p-2">
              <TaskListView tasks={groups.loose} projects={projects} onOpen={onOpenTask} onChanged={onChanged} enableBulk={false} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

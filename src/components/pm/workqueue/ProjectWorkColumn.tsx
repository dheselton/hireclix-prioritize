import { FolderOpen } from "lucide-react";
import { ProjectBriefingCard } from "./ProjectBriefingCard";
import type { PmTask, PmProject } from "@/types/pm";

type ProjectWithMeta = PmProject & {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  my_top_tasks: PmTask[];
  my_total: number;
};

interface Props {
  projects: ProjectWithMeta[];
}

export function ProjectWorkColumn({ projects }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" /> PROJECT WORK
        </h2>
        <span className="text-[11px] text-muted-foreground">{projects.length}</span>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No active projects right now.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectBriefingCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

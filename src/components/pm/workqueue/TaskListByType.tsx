import { useMemo } from "react";
import { RequestTaskCard } from "@/components/pm/collections/RequestTaskCard";
import { ProjectTaskCard } from "@/components/pm/collections/ProjectTaskCard";
import type { PmProject, PmTask } from "@/types/pm";

interface Props {
  tasks: PmTask[];
  projects: Map<string, PmProject>;
  phaseNames: Map<string, string>;
  clientNames: Map<string, string>;
  variant: "request" | "project";
  onOpen: (id: string) => void;
  onChanged?: () => void;
  emptyHint?: string;
}

/**
 * Renders a flat list of tasks using either the compact Request card
 * or the rich Project card. Project variant groups consecutive tasks
 * from the same project under a single header.
 */
export function TaskListByType({
  tasks, projects, phaseNames, clientNames, variant, onOpen, onChanged, emptyHint,
}: Props) {
  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // group by project for visual cohesion, then by due date
      const pa = a.project_id ?? "";
      const pb = b.project_id ?? "";
      if (pa !== pb) {
        const ta = projects.get(pa)?.title ?? "";
        const tb = projects.get(pb)?.title ?? "";
        return ta.localeCompare(tb);
      }
      const ad = a.due_date ?? "9999-12-31";
      const bd = b.due_date ?? "9999-12-31";
      return ad.localeCompare(bd);
    });
  }, [tasks, projects]);

  if (sorted.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed rounded-md">
        {emptyHint ?? "Nothing here."}
      </div>
    );
  }

  if (variant === "request") {
    return (
      <div className="space-y-1.5">
        {sorted.map(t => (
          <RequestTaskCard
            key={t.id}
            task={t}
            clientName={clientNames.get(projects.get(t.project_id)?.client_id ?? "") ?? null}
            onOpen={onOpen}
            onChanged={onChanged}
          />
        ))}
      </div>
    );
  }

  // Project variant — show project header once per consecutive run
  let lastProjectId: string | null = null;
  return (
    <div className="space-y-2">
      {sorted.map(t => {
        const project = projects.get(t.project_id);
        const headerForThis = project && project.id !== lastProjectId;
        if (project) lastProjectId = project.id;
        return (
          <ProjectTaskCard
            key={t.id}
            task={t}
            project={project}
            phaseName={t.phase_id ? phaseNames.get(t.phase_id) ?? null : null}
            clientName={clientNames.get(project?.client_id ?? "") ?? null}
            showProjectHeader={!!headerForThis}
            onOpen={onOpen}
            onChanged={onChanged}
          />
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, FolderKanban } from "lucide-react";
import { fetchProjects, fetchTasks } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject, PmTask } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { isSubmitterOnly } from "@/lib/pm/permissions";
import { useViewMode } from "@/hooks/useViewMode";
import { ProjectListView } from "@/components/pm/collections/ProjectListView";
import { ProjectGridView } from "@/components/pm/collections/ProjectGridView";
import { ProjectWorkGrid } from "@/components/pm/collections/ProjectWorkGrid";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { useMyProjectIds } from "@/hooks/useMyProjectIds";
import { applyProjectChips, applyProjectMeMode, applyProjectMilestones } from "@/lib/pm/filters";
import { useCreateWork } from "@/components/pm/CreateWorkProvider";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { MilestoneFilterToggle } from "@/components/pm/MilestoneFilterToggle";

export default function ProjectList() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const { openCreateWork } = useCreateWork();
  const { user, roles } = useCurrentUser();
  const [mode, setMode] = useViewMode("projects", "projects");
  const drawer = useTaskDrawerLink();
  const { isMe } = useMeMode();
  const chips = useChipFilters("projects");
  const memberIds = useMyProjectIds();
  const wt = useWorkTypeFilter("projects");
  const hideCreate = isSubmitterOnly(roles);
  const [milestoneFilter, setMilestoneFilter] = useState<string[]>([]);
  const [groupByMilestone, setGroupByMilestone] = useState(false);

  const reload = async () => {
    const [p, t] = await Promise.all([fetchProjects(), fetchTasks()]);
    setProjects(p); setTasks(t);
  };
  useEffect(() => { reload(); }, []);
  useTasksChanged(reload);

  const visible = useMemo(() => {
    let v = applyProjectMeMode(projects, isMe, user?.id, memberIds);
    v = applyProjectChips(v, tasks, chips.active, user?.id, memberIds);
    if (wt.value !== "all") v = v.filter(p => (p as any).work_type === wt.value);
    v = applyProjectMilestones(v, milestoneFilter);
    return v;
  }, [projects, tasks, isMe, user?.id, memberIds, chips.active, wt.value, milestoneFilter]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <CollectionToolbar
        title="Projects"
        subtitle={`${visible.length} of ${projects.length} total`}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        modes={["projects", "list", "grid"]}
        chipState={{ ...chips, hide: ["watching"] }}
        extraControls={
          <div className="flex items-center gap-2 flex-wrap">
            <WorkTypeFilterToggle value={wt.value} onChange={wt.set} />
            <MilestoneFilterToggle value={milestoneFilter} onChange={setMilestoneFilter} />
          </div>
        }
        actions={hideCreate ? null : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openCreateWork("request")}>
              <Zap className="h-4 w-4 mr-1" /> Quick Request
            </Button>
            <Button size="sm" onClick={() => openCreateWork("project")}>
              <FolderKanban className="h-4 w-4 mr-1" /> Project
            </Button>
          </div>
        )}
      />

      {mode === "projects" ? (
        (() => {
          const visIds = new Set(visible.map(p => p.id));
          const projMap = new Map(visible.map(p => [p.id, p]));
          const scopedTasks = tasks.filter(t => t.project_id && visIds.has(t.project_id));
          return (
            <ProjectWorkGrid
              tasks={scopedTasks}
              projects={projMap}
              meId={user?.id ?? null}
              onOpenTask={drawer.open}
              onChanged={reload}
              hideLoose
            />
          );
        })()
      ) : mode === "list" ? (
        <ProjectListView
          projects={visible}
          tasks={tasks}
          groupByMilestone={groupByMilestone}
          onGroupByMilestoneChange={setGroupByMilestone}
        />
      ) : (
        <ProjectGridView projects={visible} tasks={tasks} />
      )}

      <TaskDrawer />
    </div>
  );
}

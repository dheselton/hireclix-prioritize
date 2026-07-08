import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Zap, FolderKanban } from "lucide-react";
import { fetchProjects, fetchTasks } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject, PmTask } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { useViewMode } from "@/hooks/useViewMode";
import { ProjectListView } from "@/components/pm/collections/ProjectListView";
import { ProjectGridView } from "@/components/pm/collections/ProjectGridView";
import { ProjectWorkGrid } from "@/components/pm/collections/ProjectWorkGrid";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { useMyProjectIds } from "@/hooks/useMyProjectIds";
import { applyProjectChips, applyProjectMeMode } from "@/lib/pm/filters";
import { CreateWorkDialog } from "@/components/pm/CreateWorkDialog";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { supabase } from "@/integrations/supabase/client";

export default function ProjectList() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [open, setOpen] = useState<null | "select" | "request" | "project">(null);
  const { user } = useCurrentUser();
  const [mode, setMode] = useViewMode("projects", "projects");
  const drawer = useTaskDrawerLink();
  const { isMe } = useMeMode();
  const chips = useChipFilters("projects");
  const memberIds = useMyProjectIds();
  const wt = useWorkTypeFilter("projects");

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
    return v;
  }, [projects, tasks, isMe, user?.id, memberIds, chips.active, wt.value]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <CollectionToolbar
        title="Projects"
        subtitle={`${visible.length} of ${projects.length} total`}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        modes={["projects", "list", "grid"]}
        chipState={{ ...chips, hide: ["watching"] }}
        extraControls={<WorkTypeFilterToggle value={wt.value} onChange={wt.set} />}
        actions={user?.role === "submitter" ? null : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen("request")}>
              <Zap className="h-4 w-4 mr-1" /> Quick Request
            </Button>
            <Button size="sm" onClick={() => setOpen("project")}>
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
        <ProjectListView projects={visible} tasks={tasks} />
      ) : (
        <ProjectGridView projects={visible} tasks={tasks} />
      )}

      <CreateWorkDialog
        open={open !== null}
        onOpenChange={(v) => { if (!v) setOpen(null); }}
        initialStep={open ?? "select"}
        onCreated={reload}
      />
      <TaskDrawer />
    </div>
  );
}

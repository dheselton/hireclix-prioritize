import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Rocket } from "lucide-react";
import { ConvertToProjectModal } from "@/components/pm/ConvertToProjectModal";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProject, fetchTasks, fetchPhases, fetchDependencies,
  updateProject, updateTask, logActivity,
} from "@/lib/pm/api";
import { useTasksChanged, useTaskDateProposed } from "@/lib/pm/refresh";
import type { PmProject, PmTask, PmPhase, PmDependency } from "@/types/pm";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { CascadeConfirmModal } from "@/components/pm/CascadeConfirmModal";
import { recalculateBackwardFromGoLive, recalculateForward, type DateDiff } from "@/lib/pm/scheduler";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";
import { FilesTab } from "@/components/pm/project/FilesTab";
import { ProjectHeader } from "@/components/pm/project/ProjectHeader";
import { KpiStrip } from "@/components/pm/project/KpiStrip";
import { ProjectTabs, type ProjectTabId } from "@/components/pm/project/ProjectTabs";
import { OverviewTab } from "@/components/pm/project/OverviewTab";
import { TasksTab } from "@/components/pm/project/TasksTab";
import { SnippetsTab } from "@/components/pm/project/SnippetsTab";
import { PagesTab } from "@/components/pm/project/PagesTab";
import { NewTaskDialog } from "@/components/pm/project/NewTaskDialog";
import { DocumentationTab } from "@/components/pm/project/DocumentationTab";
import { SupportReadyBanner } from "@/components/pm/project/SupportReadyBanner";
import { DiscoveryReadyBanner } from "@/components/pm/project/DiscoveryReadyBanner";
import { QaTab } from "@/components/pm/project/QaTab";
import { QaBatchPasteDialog } from "@/components/pm/project/QaBatchPasteDialog";
import { isInQaMode } from "@/lib/pm/qaMode";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const [project, setProject] = useState<PmProject | null>(null);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [deps, setDeps] = useState<PmDependency[]>([]);
  const drawer = useTaskDrawerLink();

  const [tab, setTab] = useState<ProjectTabId>(() => {
    // Deep links (?section=tasks) land directly on the right tab; strip the param
    // afterwards so a reload doesn't fight manual tab changes.
    if (typeof window === "undefined") return "tasks";
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("section");
      const valid: ProjectTabId[] = ["overview", "tasks", "qa", "timeline", "pages", "files", "snippets", "documentation"];
      if (s && (valid as string[]).includes(s)) {
        params.delete("section");
        const url = new URL(window.location.href);
        url.search = params.toString();
        window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
        return s as ProjectTabId;
      }
    } catch {}
    return "tasks";
  });
  const [pendingDiffs, setPendingDiffs] = useState<DateDiff[]>([]);
  const [pendingGoLive, setPendingGoLive] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"forward" | "backward">("backward");
  const [convertOpen, setConvertOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskSupport, setNewTaskSupport] = useState(false);
  const [newTaskKind, setNewTaskKind] = useState<"task" | "decision" | "issue" | "qa">("task");
  const [qaBatchOpen, setQaBatchOpen] = useState(false);

  const reload = async () => {
    if (!id) return;
    const [p, t, ph, d] = await Promise.all([fetchProject(id), fetchTasks(id), fetchPhases(id), fetchDependencies(id)]);
    setProject(p); setTasks(t); setPhases(ph); setDeps(d);
  };
  useEffect(() => { reload(); }, [id]);
  useTasksChanged(reload);

  useTaskDateProposed(({ taskId, start, end }) => {
    if (!tasks.find(t => t.id === taskId)) return;
    const diffs = recalculateForward(taskId, { start, end }, tasks, deps);
    if (!diffs.length) return;
    setPendingMode("forward");
    setPendingGoLive(null);
    setPendingDiffs(diffs);
  });

  async function handleGoLiveChange(newDate: string) {
    if (!project) return;
    if (!tasks.length) { await updateProject(project.id, { go_live_date: newDate }); reload(); return; }
    const diffs = recalculateBackwardFromGoLive(newDate, tasks, deps);
    setPendingMode("backward");
    setPendingDiffs(diffs);
    setPendingGoLive(newDate);
  }

  async function applyCascade() {
    if (!project) return;
    if (pendingMode === "backward" && pendingGoLive) {
      await updateProject(project.id, { go_live_date: pendingGoLive });
      await logActivity({ project_id: project.id, user_id: user?.id, action: "project.go_live_changed", payload: { go_live: pendingGoLive, shifted: pendingDiffs.length } });
    } else {
      await logActivity({ project_id: project.id, user_id: user?.id, action: "task.dates_cascaded", payload: { shifted: pendingDiffs.length } });
    }
    for (const d of pendingDiffs) await updateTask(d.taskId, { start_date: d.newStart, due_date: d.newEnd });
    toast.success(`${pendingDiffs.length} task${pendingDiffs.length === 1 ? "" : "s"} updated`);
    setPendingDiffs([]); setPendingGoLive(null);
    reload();
  }


  if (!project) return <div className="p-6">Loading…</div>;
  const p: any = project;
  const isRequest = (p.work_type ?? "project") === "request";
  const myRoles = user?.roles ?? (user?.role ? [user.role] : []);
  const isPM = myRoles.includes("pm");
  // Prefer a "doer" role for the New Task default type; PM is the fallback.
  const defaultTaskRole =
    ((["developer", "designer", "strategist", "analyst"] as any[]).find(r => (myRoles as any[]).includes(r))) ??
    myRoles[0] ?? user?.role ?? null;
  const inSupport = !!(project.custom_fields as any)?.support_mode_at;
  const inQa = isInQaMode(project);

  const canSeeSnippets = !!user?.roles?.some(r => r === "developer" || r === "designer") || user?.role === "developer" || user?.role === "designer";

  const hasTemplate = !!project.template_id;
  const tabs: { id: ProjectTabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    ...(inQa ? [{ id: "qa" as const, label: "QA" }] : []),
    ...(!isRequest ? [{ id: "timeline" as const, label: "Timeline" }] : []),
    ...(!isRequest && hasTemplate ? [{ id: "pages" as const, label: "Pages" }] : []),
    { id: "files", label: "Files" },
    ...(canSeeSnippets ? [{ id: "snippets" as const, label: "Snippets" }] : []),
    ...(inSupport ? [{ id: "documentation" as const, label: "Documentation" }] : []),
  ];


  return (
    <div className="p-3 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <UnclaimedBanner projectId={project.id} />

      <ProjectHeader
        project={project}
        onAddTask={() => { setTab("tasks"); setNewTaskSupport(false); setNewTaskKind("task"); setNewTaskOpen(true); }}
        onLogSupportRequest={() => { setTab("tasks"); setNewTaskSupport(true); setNewTaskKind("task"); setNewTaskOpen(true); }}
        onLogQaBatch={() => { setTab("qa"); setQaBatchOpen(true); }}
      />
      <SupportReadyBanner project={project} />
      {!isRequest && hasTemplate && (
        <DiscoveryReadyBanner
          projectId={project.id}
          templateId={project.template_id}
          tasks={tasks}
          onDefinePages={() => setTab("pages")}
        />
      )}
      <KpiStrip project={project} tasks={tasks} />

      {isRequest && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setConvertOpen(true)}>
            <Rocket className="h-4 w-4 mr-1" /> Convert to Project
          </Button>
        </div>
      )}

      <ProjectTabs value={tab} onChange={setTab} tabs={tabs} />

      {tab === "overview" && (
        <div className="space-y-4">
          {isRequest && project.custom_fields && Object.keys(project.custom_fields).filter(k => k !== "request_type").length > 0 && (
            <Card><CardContent className="p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                Request details
                {project.custom_fields.request_type && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted">
                    {String(project.custom_fields.request_type).replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {Object.entries(project.custom_fields)
                  .filter(([k]) => k !== "request_type")
                  .map(([k, v]: [string, any]) => {
                    const label = v?.label ?? k;
                    const value = v?.value ?? v;
                    const display = Array.isArray(value) ? value.join(", ") : String(value);
                    return (
                      <div key={k} className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="break-words">{display || <span className="text-muted-foreground italic">—</span>}</dd>
                      </div>
                    );
                  })}
              </dl>
            </CardContent></Card>
          )}
          <OverviewTab
            project={project} tasks={tasks}
            onProjectChange={setProject}
            onGoLiveChange={handleGoLiveChange}
            isPM={isPM} reload={reload}
          />
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-3">
          <TasksTab
            tasks={tasks}
            deps={deps}
            projectId={project.id}
            meId={user?.id ?? null}
            templateId={project.template_id}
            onAddTask={() => { setNewTaskSupport(false); setNewTaskKind("task"); setNewTaskOpen(true); }}
            onAddRaid={(k) => { setNewTaskSupport(false); setNewTaskKind(k); setNewTaskOpen(true); }}
            supportMode={inSupport}
          />
        </div>
      )}

      {tab === "qa" && inQa && (
        <QaTab
          tasks={tasks}
          onNewTicket={() => { setNewTaskSupport(false); setNewTaskKind("qa"); setNewTaskOpen(true); }}
          onBatchPaste={() => setQaBatchOpen(true)}
        />
      )}

      {tab === "documentation" && inSupport && (
        <DocumentationTab project={project} canEdit={isPM} onProjectChange={setProject} />
      )}

      {tab === "timeline" && !isRequest && (
        <Card className="bg-secondary">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Timeline view — tasks plotted against go-live date with locked milestones (Phase 2)
          </CardContent>
        </Card>
      )}

      {tab === "pages" && !isRequest && hasTemplate && (
        <PagesTab projectId={project.id} templateId={project.template_id} tasks={tasks} />
      )}

      {tab === "files" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">All files attached to this project and its tasks, in one place.</p>
          <FilesTab projectId={project.id} tasks={tasks} onOpenTask={drawer.open} />
        </div>
      )}

      {tab === "snippets" && canSeeSnippets && (
        <SnippetsTab projectId={project.id} tasks={tasks} />
      )}

      <TaskDrawer />
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={(o) => { setNewTaskOpen(o); if (!o) { setNewTaskSupport(false); setNewTaskKind("task"); } }}
        project={project}
        phases={phases}
        meId={user?.id ?? null}
        meRole={defaultTaskRole}
        onCreated={reload}
        initialSupport={newTaskSupport}
        initialKind={newTaskKind}
      />
      <CascadeConfirmModal
        open={pendingDiffs.length > 0 || !!pendingGoLive}
        onOpenChange={(v) => { if (!v) { setPendingDiffs([]); setPendingGoLive(null); reload(); } }}
        diffs={pendingDiffs}
        goLiveDate={pendingMode === "backward" ? pendingGoLive : project.go_live_date}
        onConfirm={applyCascade}
      />
      <ConvertToProjectModal open={convertOpen} onOpenChange={setConvertOpen} projectId={project.id} userId={user?.id ?? null} onConverted={reload} />
      <QaBatchPasteDialog open={qaBatchOpen} onOpenChange={setQaBatchOpen} project={project} onCreated={reload} />
    </div>
  );
}

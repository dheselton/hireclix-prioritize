import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Rocket } from "lucide-react";
import { ConvertToProjectModal } from "@/components/pm/ConvertToProjectModal";
import { supabase } from "@/integrations/supabase/client";
import {
  updateProject, updateTask, logActivity,
} from "@/lib/pm/api";
import { useTaskDateProposed } from "@/lib/pm/refresh";
import type { PmProject, PmTask } from "@/types/pm";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { CascadeConfirmModal } from "@/components/pm/CascadeConfirmModal";
import { recalculateBackwardFromGoLive, recalculateForward, type DateDiff } from "@/lib/pm/scheduler";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";
import { FilesTab } from "@/components/pm/project/FilesTab";
import { ProjectHeader } from "@/components/pm/project/ProjectHeader";
import { KpiStrip } from "@/components/pm/project/KpiStrip";
import { ProjectTabs, type ProjectTabId } from "@/components/pm/project/ProjectTabs";
import { canPostClientVisible } from "@/lib/pm/permissions";
import { PortalMessageThread } from "@/components/pm/portal/PortalMessageThread";
import { OverviewTab } from "@/components/pm/project/OverviewTab";
import { TasksTab } from "@/components/pm/project/TasksTab";
import { SnippetsTab } from "@/components/pm/project/SnippetsTab";
import { PagesTab } from "@/components/pm/project/PagesTab";
import { ProjectTimelineTab } from "@/components/pm/project/ProjectTimelineTab";

import { NewTaskDialog } from "@/components/pm/project/NewTaskDialog";
import { DocumentationTab } from "@/components/pm/project/DocumentationTab";
import { SupportReadyBanner } from "@/components/pm/project/SupportReadyBanner";
import { DiscoveryReadyBanner } from "@/components/pm/project/DiscoveryReadyBanner";
import { QaTab } from "@/components/pm/project/QaTab";
import { QaBatchPasteDialog } from "@/components/pm/project/QaBatchPasteDialog";
import { isInQaMode } from "@/lib/pm/qaMode";
import {
  pmQueryKeys,
  useProjectDependenciesQuery,
  useProjectPhasesQuery,
  useProjectQuery,
  useProjectTasksQuery,
} from "@/lib/pm/queries";
import { useQueryClient } from "@tanstack/react-query";
import { WorkLoadError, WorkPageSkeleton } from "@/components/pm/WorkLoadingState";

/** Why a mode-gated tab isn't reachable on a given project. */
const UNAVAILABLE_TAB_REASON: Partial<Record<ProjectTabId, string>> = {
  qa: "QA mode is not active on this project — showing Overview instead.",
  pages: "This project doesn't have a Pages tab — showing Overview instead.",
  documentation: "This project isn't in Support mode — showing Overview instead.",
  snippets: "Snippets are only available to design and dev roles — showing Overview instead.",
  timeline: "Requests don't have a Project Timeline — showing Overview instead.",
};

/** The tabs a given project + viewer can actually render. Mirrors the tab strip. */
function computeAvailableTabs(project: PmProject, user: any): ProjectTabId[] {
  const isRequest = ((project as any).work_type ?? "project") === "request";
  const inSupport = !!(project.custom_fields as any)?.support_mode_at;
  const inQa = isInQaMode(project);
  const hasTemplate = !!project.template_id;
  const canSeeSnippets =
    !!user?.roles?.some((r: string) => r === "developer" || r === "designer") ||
    user?.role === "developer" || user?.role === "designer";

  return [
    "overview",
    "tasks",
    ...(inQa ? (["qa"] as const) : []),
    ...(!isRequest ? (["timeline"] as const) : []),
    ...(!isRequest && hasTemplate ? (["pages"] as const) : []),
    "files",
    ...(canPostClientVisible(user?.roles ?? user?.role) ? (["client"] as const) : []),
    ...(canSeeSnippets ? (["snippets"] as const) : []),
    ...(inSupport ? (["documentation"] as const) : []),
  ] as ProjectTabId[];

}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();

  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const projectQuery = useProjectQuery(id);
  const tasksQuery = useProjectTasksQuery(id);
  const phasesQuery = useProjectPhasesQuery(id);
  const tasks = tasksQuery.data ?? [];
  const depsQuery = useProjectDependenciesQuery(id, tasks.map(task => task.id), !tasksQuery.isPending);
  const project = projectQuery.data ?? null;
  const phases = phasesQuery.data ?? [];
  const deps = depsQuery.data ?? [];
  const setProject = (next: PmProject) => {
    if (!id) return;
    queryClient.setQueryData(pmQueryKeys.project(id), next);
    queryClient.setQueryData<PmProject[]>(pmQueryKeys.allProjects(), current =>
      current?.map(item => item.id === next.id ? next : item),
    );
  };
  const drawer = useTaskDrawerLink();

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<ProjectTabId>(() => {
    // Prefer ?tab=; accept legacy ?section= from older deep links.
    const t = searchParams.get("tab") ?? searchParams.get("section");
    const valid: ProjectTabId[] = ["overview", "tasks", "qa", "timeline", "pages", "files", "snippets", "documentation", "client"];
    if (t && (valid as string[]).includes(t)) return t as ProjectTabId;
    return "overview";
  });
  // A requested ?tab= is only honored once we know the project — several tabs
  // are mode-gated (QA mode, support mode, career-site template, role). The
  // validation effect below runs after load and falls back with an explanation.
  const [tabChecked, setTabChecked] = useState(false);

  const handleSetTab = (newTab: ProjectTabId) => {
    setTab(newTab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", newTab);
    next.delete("section");
    setSearchParams(next, { replace: true });
  };

  // Keep local tab state in sync when deep links change ?tab= (e.g. Overview metrics).
  useEffect(() => {
    const t = searchParams.get("tab") ?? searchParams.get("section");
    const valid: ProjectTabId[] = ["overview", "tasks", "qa", "timeline", "pages", "files", "snippets", "documentation", "client"];
    if (t && (valid as string[]).includes(t) && t !== tab) {
      setTab(t as ProjectTabId);
    }
  }, [searchParams, tab]);


  const [pendingDiffs, setPendingDiffs] = useState<DateDiff[]>([]);
  const [pendingGoLive, setPendingGoLive] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"forward" | "backward">("backward");
  const [convertOpen, setConvertOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskSupport, setNewTaskSupport] = useState(false);
  const [newTaskKind, setNewTaskKind] = useState<"task" | "decision" | "issue" | "qa">("task");
  const [qaBatchOpen, setQaBatchOpen] = useState(false);

  const reload = () => {
    void projectQuery.refetch();
    void tasksQuery.refetch();
    void phasesQuery.refetch();
    void depsQuery.refetch();
  };

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

  // Which tabs this specific project actually renders (mode/role gated).
  const availableTabs = useMemo<ProjectTabId[] | null>(
    () => (project ? computeAvailableTabs(project, user) : null),
    [project, user],
  );

  // A ?tab= pointing at a gated tab used to be accepted silently and render
  // nothing. Fall back to Overview and say why.
  useEffect(() => {
    if (!availableTabs || tabChecked) return;
    setTabChecked(true);
    const requested = (searchParams.get("tab") ?? searchParams.get("section")) as ProjectTabId | null;
    if (!requested || availableTabs.includes(requested)) return;
    setTab("overview");
    const next = new URLSearchParams(searchParams);
    next.set("tab", "overview");
    next.delete("section");
    setSearchParams(next, { replace: true });
    toast.info(
      UNAVAILABLE_TAB_REASON[requested] ??
        "That tab isn't available on this project — showing Overview instead.",
    );
  }, [availableTabs, tabChecked, searchParams, setSearchParams]);

  const loading = projectQuery.isPending || tasksQuery.isPending || phasesQuery.isPending || depsQuery.isPending;
  const loadError = projectQuery.isError || tasksQuery.isError || phasesQuery.isError || depsQuery.isError;
  if (loading) return <WorkPageSkeleton />;
  if (loadError) return <div className="page-shell"><WorkLoadError retry={reload} /></div>;
  if (!project) return <div className="page-shell text-sm text-muted-foreground">Project not found.</div>;
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
  const canShareWithClient = canPostClientVisible(user?.roles ?? user?.role);
  const tabs: { id: ProjectTabId; label: string; badge?: React.ReactNode }[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    ...(inQa ? [{ id: "qa" as const, label: "QA" }] : []),
    ...(!isRequest ? [{ id: "timeline" as const, label: "Project Timeline" }] : []),
    ...(!isRequest && hasTemplate ? [{ id: "pages" as const, label: "Pages" }] : []),
    { id: "files", label: "Files" },
    ...(canShareWithClient ? [{ id: "client" as const, label: "Client" }] : []),
    ...(canSeeSnippets ? [{ id: "snippets" as const, label: "Snippets" }] : []),
    ...(inSupport ? [{ id: "documentation" as const, label: "Documentation" }] : []),

  ];


  return (
    <div className="page-shell max-w-[1400px] mx-auto space-y-4">
      <UnclaimedBanner projectId={project.id} />

      <ProjectHeader
        project={project}
        onAddTask={() => { handleSetTab("tasks"); setNewTaskSupport(false); setNewTaskKind("task"); setNewTaskOpen(true); }}
        onLogSupportRequest={() => { handleSetTab("tasks"); setNewTaskSupport(true); setNewTaskKind("task"); setNewTaskOpen(true); }}
        onLogQaBatch={() => { handleSetTab("qa"); setQaBatchOpen(true); }}
      />
      <SupportReadyBanner project={project} />
      {!isRequest && hasTemplate && (
        <DiscoveryReadyBanner
          projectId={project.id}
          templateId={project.template_id}
          tasks={tasks}
          onDefinePages={() => handleSetTab("pages")}
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

      <ProjectTabs value={tab} onChange={handleSetTab} tabs={tabs} />

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
        <ProjectTimelineTab
          project={project}
          tasks={tasks}
          onGoToOverview={() => handleSetTab("overview")}
        />
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

      {tab === "client" && canShareWithClient && (
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-muted-foreground">
            Shared conversation with the client for this project. Anything posted here is visible in the client portal.
          </p>
          <PortalMessageThread
            projectId={project.id}
            authorName={user?.name ?? "Team"}
            authorUserId={user?.id ?? null}
          />
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

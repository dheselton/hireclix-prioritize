import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Eye, EyeOff, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { logActivity, updateTask, deleteTask } from "@/lib/pm/api";
import { recordTaskActivity } from "@/lib/pm/activity";
import { emitTasksChanged } from "@/lib/pm/refresh";
import type { PmTask, TaskStatus } from "@/types/pm";
import { cn } from "@/lib/utils";

import { ControlPanel } from "@/components/pm/workspace/ControlPanel";
import { TaskMetaCard } from "@/components/pm/workspace/TaskMetaCard";
import { LinksSection } from "@/components/pm/workspace/LinksSection";
import { AssetHub } from "@/components/pm/workspace/AssetHub";
import { CollabHub } from "@/components/pm/workspace/CollabHub";
import { QuickChecklist } from "@/components/pm/workspace/QuickChecklist";
import { TimerPill } from "@/components/pm/workspace/TimerPill";

import { PriorityFlag } from "@/components/pm/PriorityFlag";

import { SnippetsSection } from "@/components/pm/workspace/SnippetsSection";
import { DescriptionSection } from "@/components/pm/workspace/DescriptionSection";
import { RequestContextPanel } from "@/components/pm/workspace/RequestContextPanel";
import { IncidentContextBanner } from "@/components/pm/workspace/IncidentContextBanner";
import { UpcomingBanner } from "@/components/pm/workspace/UpcomingBanner";
import { DependenciesSection } from "@/components/pm/drawer/DependenciesSection";
import { DesignRoundsSection } from "@/components/pm/drawer/DesignRoundsSection";
import { BlockerBanner } from "@/components/pm/drawer/Banners";
import { TaskDrawer } from "@/components/pm/TaskDrawer";
import { pinTask, unpinTask, useIsTaskPinned } from "@/lib/pm/pinnedTasks";
import { useIsWatchingProject, watchProject, unwatchProject } from "@/lib/pm/watchers";

const TRACK_COLOR: Record<string, string> = {
  pm: "hsl(var(--track-pm))",
  production: "hsl(var(--track-production))",
  strategy: "hsl(var(--role-designer))",
  analytics: "hsl(var(--role-developer))",
};

function trackColor(t?: string | null) {
  return TRACK_COLOR[t ?? ""] ?? "hsl(var(--primary))";
}

interface Crumbs {
  projectTitle: string;
  clientName: string;
  phaseName: string;
}

export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { user } = useCurrentUser();
  const [task, setTask] = useState<PmTask | null>(null);
  const [crumbs, setCrumbs] = useState<Crumbs>({ projectTitle: "", clientName: "", phaseName: "" });
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<TaskStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function performDelete() {
    if (!task) return;
    try {
      await deleteTask(task.id);
      emitTasksChanged();
      toast.success("Task deleted");
      navigate(`/pm/projects/${task.project_id}`);
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message ?? "unknown error"}`);
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("pm_tasks").select("*").eq("id", id).maybeSingle();
      const t = (data as any) ?? null;
      setTask(t);
      setLoading(false);
      if (!t) return;
      prevStatusRef.current = t.status;
      if (user?.id) recordTaskActivity(user.id, t.project_id, t.id);

      const [{ data: proj }, { data: phase }] = await Promise.all([
        supabase
          .from("pm_projects")
          .select("title, clients(name)")
          .eq("id", t.project_id)
          .maybeSingle(),
        t.phase_id
          ? supabase.from("pm_project_phases").select("name").eq("id", t.phase_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setCrumbs({
        projectTitle: (proj as any)?.title ?? "",
        clientName: (proj as any)?.clients?.name ?? "",
        phaseName: (phase as any)?.name ?? "",
      });
    })();
  }, [id, user?.id]);

  async function patch(p: Partial<PmTask>) {
    if (!task) return;
    try {
      const updated = await updateTask(task.id, p);
      setTask(updated as any);
      await logActivity({ task_id: task.id, project_id: task.project_id, user_id: user?.id, action: "task.updated", payload: p });
      emitTasksChanged();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "unknown error"}`);
    }
  }

  function openQuickEdit() {
    setParams(prev => { const p = new URLSearchParams(prev); p.set("task", task!.id); return p; });
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading task…</div>;
  if (!task) return <div className="p-8">Task not found. <Button variant="link" onClick={() => navigate("/pm")}>Back to Work Queue</Button></div>;

  const dotColor = trackColor(task.track);

  return (
    <div className="min-h-full bg-muted/10">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="text-xs text-muted-foreground truncate">
              <button className="hover:underline" onClick={() => navigate("/pm/projects")}>Projects</button>
              <span className="mx-1.5">/</span>
              {crumbs.projectTitle && (
                <>
                  <button className="hover:underline" onClick={() => navigate(`/pm/projects/${task.project_id}`)}>
                    {crumbs.clientName || crumbs.projectTitle}
                  </button>
                  {crumbs.phaseName && (
                    <>
                      <span className="mx-1.5">/</span>
                      <span>{crumbs.phaseName}</span>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TimerPill taskId={task.id} taskTitle={task.title} />
              <div className="hidden md:flex items-center gap-2">
                <PinTaskButton taskId={task.id} userId={user?.id ?? null} />
                <WatchProjectButton projectId={task.project_id} userId={user?.id ?? null} />
                <Button variant="outline" size="sm" onClick={openQuickEdit}>
                  <Pencil className="h-3 w-3 mr-1" /> Quick edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
              <MobileActionsMenu
                taskId={task.id}
                projectId={task.project_id}
                userId={user?.id ?? null}
                onQuickEdit={openQuickEdit}
                onRequestDelete={() => setConfirmDelete(true)}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <PriorityFlag priority={task.priority} size="md" />
            <Input

              value={task.title}
              onChange={e => setTask({ ...task, title: e.target.value })}
              onBlur={e => patch({ title: e.target.value })}
              className="text-xl font-bold border-0 px-0 h-auto py-0.5 focus-visible:ring-0 shadow-none bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* BODY: 1fr / 300px */}
      <div className="max-w-[1400px] mx-auto px-3 md:px-4 py-4 md:py-6">
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:[grid-template-columns:minmax(0,1fr)_300px]">
          {/* LEFT */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            <RequestContextPanel projectId={task.project_id} />
            <UpcomingBanner taskId={task.id} />
            {(task.custom_fields as any)?.snippet_incident_id && (
              <IncidentContextBanner
                incidentId={(task.custom_fields as any).snippet_incident_id}
                snippetId={(task.custom_fields as any).snippet_id ?? null}
                currentTaskId={task.id}
              />
            )}
            <DescriptionSection task={task} patch={patch} />
            {task.status === "blocked" && <BlockerBanner />}
            <AssetHub taskId={task.id} projectId={task.project_id} />
            <LinksSection taskId={task.id} />
            <SnippetsSection taskId={task.id} />
            <CollabHub taskId={task.id} projectId={task.project_id} taskTitle={task.title} />
          </div>

          {/* RIGHT */}
          <aside className="space-y-3">
            <TaskMetaCard projectId={task.project_id} phaseName={crumbs.phaseName} />
            <ControlPanel task={task} setTask={setTask} patch={patch} />
            <QuickChecklist taskId={task.id} />


            <CollapsedSection label="Show Dependencies">
              <DependenciesSection taskId={task.id} />
            </CollapsedSection>

            {task.type === "design" && (
              <CollapsedSection label="Show Design Rounds">
                <DesignRoundsSection taskId={task.id} />
              </CollapsedSection>
            )}
          </aside>
        </div>
      </div>
      <TaskDrawer />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              All data, files, and comments will be lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={performDelete}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CollapsedSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium cursor-pointer hover:bg-muted/40 transition rounded-lg"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

function PinTaskButton({ taskId, userId }: { taskId: string; userId: string | null }) {
  const { pinned, setPinned } = useIsTaskPinned(userId, taskId);
  if (!userId) return null;
  async function toggle() {
    if (pinned) { await unpinTask(userId, taskId); setPinned(false); toast.success("Unpinned from your timesheet"); }
    else { await pinTask(userId, taskId); setPinned(true); toast.success("Pinned to your timesheet"); }
  }
  return (
    <Button variant="outline" size="sm" onClick={toggle} title={pinned ? "Unpin from timesheet quick-add" : "Pin to timesheet quick-add"}>
      <Star className={cn("h-3 w-3 mr-1", pinned && "fill-amber-500 text-amber-500")} />
      {pinned ? "Pinned" : "Pin"}
    </Button>
  );
}

function WatchProjectButton({ projectId, userId }: { projectId: string | null; userId: string | null }) {
  const { watching, setWatching } = useIsWatchingProject(userId, projectId);
  if (!userId || !projectId) return null;
  async function toggle() {
    if (watching) {
      await unwatchProject(userId!, projectId!);
      setWatching(false);
      toast.success("Stopped watching this project");
    } else {
      await watchProject(userId!, projectId!);
      setWatching(true);
      toast.success("Watching this project — it'll show under the Watching filter");
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      title={watching ? "Stop watching this project" : "Watch this project (adds tasks to your Watching filter)"}
    >
      {watching ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
      {watching ? "Watching" : "Watch"}
    </Button>
  );
}

function MobileActionsMenu({
  taskId, projectId, userId, onQuickEdit, onRequestDelete,
}: {
  taskId: string;
  projectId: string | null;
  userId: string | null;
  onQuickEdit: () => void;
  onRequestDelete: () => void;
}) {
  const { pinned, setPinned } = useIsTaskPinned(userId, taskId);
  const { watching, setWatching } = useIsWatchingProject(userId, projectId);
  async function togglePin() {
    if (!userId) return;
    if (pinned) { await unpinTask(userId, taskId); setPinned(false); toast.success("Unpinned"); }
    else { await pinTask(userId, taskId); setPinned(true); toast.success("Pinned"); }
  }
  async function toggleWatch() {
    if (!userId || !projectId) return;
    if (watching) { await unwatchProject(userId, projectId); setWatching(false); toast.success("Stopped watching"); }
    else { await watchProject(userId, projectId); setWatching(true); toast.success("Watching project"); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" aria-label="Task actions">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 bg-popover w-56">
        <DropdownMenuItem onSelect={onQuickEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Quick edit
        </DropdownMenuItem>
        {userId && (
          <DropdownMenuItem onSelect={togglePin}>
            <Star className={cn("h-4 w-4 mr-2", pinned && "fill-amber-500 text-amber-500")} />
            {pinned ? "Unpin from timesheet" : "Pin to timesheet"}
          </DropdownMenuItem>
        )}
        {userId && projectId && (
          <DropdownMenuItem onSelect={toggleWatch}>
            {watching ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {watching ? "Unwatch project" : "Watch project"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onRequestDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}



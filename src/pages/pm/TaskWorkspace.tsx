import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { logActivity, updateTask } from "@/lib/pm/api";
import { recordTaskActivity } from "@/lib/pm/activity";
import { emitTasksChanged } from "@/lib/pm/refresh";
import type { PmTask, TaskStatus } from "@/types/pm";

import { ControlPanel } from "@/components/pm/workspace/ControlPanel";
import { LinksSection } from "@/components/pm/workspace/LinksSection";
import { FormSubmissionBlock } from "@/components/pm/workspace/FormSubmissionBlock";
import { TimerControls } from "@/components/pm/timer/TimerControls";
import { AttachmentsSection } from "@/components/pm/drawer/AttachmentsSection";
import { ChecklistSection } from "@/components/pm/drawer/ChecklistSection";
import { SubtasksSection } from "@/components/pm/drawer/SubtasksSection";
import { CommentsThread } from "@/components/pm/drawer/CommentsThread";
import { DependenciesSection } from "@/components/pm/drawer/DependenciesSection";
import { DesignRoundsSection } from "@/components/pm/drawer/DesignRoundsSection";
import { DevStatusLogSection } from "@/components/pm/drawer/DevStatusLogSection";
import { TimeTrackingSection } from "@/components/pm/drawer/TimeTrackingSection";
import { BlockerBanner } from "@/components/pm/drawer/Banners";

export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { user } = useCurrentUser();
  const [task, setTask] = useState<PmTask | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<TaskStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("pm_tasks").select("*").eq("id", id).maybeSingle();
      const t = (data as any) ?? null;
      setTask(t);
      setLoading(false);
      if (t) {
        prevStatusRef.current = t.status;
        if (user?.id) recordTaskActivity(user.id, t.project_id, t.id);
        const { data: proj } = await supabase.from("pm_projects").select("title").eq("id", t.project_id).maybeSingle();
        setProjectTitle((proj as any)?.title ?? "");
      }
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

  async function patchBlocker(text: string) {
    if (!task) return;
    const hadBlocker = !!task.dev_blocker;
    const hasBlocker = !!text;
    let nextStatus = task.status;
    if (hasBlocker && task.status !== "blocked") {
      prevStatusRef.current = task.status;
      nextStatus = "blocked";
    } else if (!hasBlocker && hadBlocker && task.status === "blocked") {
      nextStatus = prevStatusRef.current ?? "in_progress";
    }
    await patch({ dev_blocker: text, status: nextStatus });
  }

  function openQuickEdit() {
    setParams(prev => { const p = new URLSearchParams(prev); p.set("task", task!.id); return p; });
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading task…</div>;
  if (!task) return <div className="p-8">Task not found. <Button variant="link" onClick={() => navigate("/pm")}>Back to Work Queue</Button></div>;

  return (
    <div className="min-h-full bg-muted/10">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="text-xs text-muted-foreground">
            <button className="hover:underline" onClick={() => navigate(`/pm/projects/${task.project_id}`)}>{projectTitle || "Project"}</button>
            <span className="mx-1">/</span>
            <span>Task</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TimerControls taskId={task.id} taskTitle={task.title} />
            <Button variant="outline" size="sm" onClick={openQuickEdit}>
              <Pencil className="h-3 w-3 mr-1" /> Quick edit
            </Button>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 pb-3">
          <Input
            value={task.title}
            onChange={e => setTask({ ...task, title: e.target.value })}
            onBlur={e => patch({ title: e.target.value })}
            className="text-2xl font-bold border-0 px-0 h-auto py-1 focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* LEFT — Execution (70%) */}
        <div className="lg:col-span-7 space-y-4">
          {task.status === "blocked" && <BlockerBanner />}

          <AttachmentsSection taskId={task.id} projectId={task.project_id} />
          <LinksSection taskId={task.id} />
          <FormSubmissionBlock taskId={task.id} />

          <div className="border border-border rounded-lg bg-background p-4">
            <Label className="text-xs mb-2 block">Description</Label>
            <Textarea
              value={task.description ?? ""}
              rows={6}
              placeholder="Add description, context, or notes…"
              onChange={e => setTask({ ...task, description: e.target.value })}
              onBlur={e => patch({ description: e.target.value })}
            />
          </div>

          <ChecklistSection taskId={task.id} />
          <SubtasksSection taskId={task.id} />

          <CommentsThread taskId={task.id} projectId={task.project_id} taskTitle={task.title} />
        </div>

        {/* RIGHT — Control panel (30%) */}
        <div className="lg:col-span-3 space-y-4">
          <ControlPanel task={task} setTask={setTask} patch={patch} />

          <TimeTrackingSection taskId={task.id} />

          {/* Collapsible / structural — bottom of right panel */}
          <details className="border border-border rounded-lg bg-background group">
            <summary className="px-3 py-2 cursor-pointer text-sm font-semibold list-none flex items-center justify-between">
              Dependencies <span className="text-xs text-muted-foreground group-open:hidden">▸</span><span className="text-xs text-muted-foreground hidden group-open:inline">▾</span>
            </summary>
            <div className="px-3 pb-3"><DependenciesSection taskId={task.id} /></div>
          </details>

          {task.type === "design" && (
            <details className="border border-border rounded-lg bg-background group">
              <summary className="px-3 py-2 cursor-pointer text-sm font-semibold list-none">Design rounds</summary>
              <div className="px-3 pb-3"><DesignRoundsSection taskId={task.id} /></div>
            </details>
          )}

          {task.type === "dev" && (
            <>
              <details className="border border-border rounded-lg bg-background group">
                <summary className="px-3 py-2 cursor-pointer text-sm font-semibold list-none">Dev status log</summary>
                <div className="px-3 pb-3"><DevStatusLogSection task={task} /></div>
              </details>
              <details className="border border-border rounded-lg bg-background">
                <summary className="px-3 py-2 cursor-pointer text-sm font-semibold list-none flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" /> Blocker {task.dev_blocker && <span className="text-xs text-destructive">· active</span>}
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  <Textarea rows={2} value={task.dev_blocker ?? ""}
                    onChange={e => setTask({ ...task, dev_blocker: e.target.value })}
                    onBlur={e => patchBlocker(e.target.value)} />
                  <Label className="text-xs">Environment notes</Label>
                  <Textarea rows={2} value={task.dev_environment ?? ""}
                    onChange={e => setTask({ ...task, dev_environment: e.target.value })}
                    onBlur={e => patch({ dev_environment: e.target.value })} />
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

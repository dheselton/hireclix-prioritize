import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { logActivity, updateTask } from "@/lib/pm/api";
import { recordTaskActivity } from "@/lib/pm/activity";
import { emitTasksChanged, emitTaskDateProposed } from "@/lib/pm/refresh";
import { TASK_STATUSES, TASK_TYPES, PRIORITIES, type PmTask, type TaskStatus, type TaskType, type TaskPriority } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { SubtasksSection } from "./drawer/SubtasksSection";
import { ChecklistSection } from "./drawer/ChecklistSection";
import { AttachmentsSection } from "./drawer/AttachmentsSection";
import { DependenciesSection, useBlockedByCount } from "./drawer/DependenciesSection";
import { TimeTrackingSection } from "./drawer/TimeTrackingSection";
import { DesignRoundsSection } from "./drawer/DesignRoundsSection";
import { DevStatusLogSection } from "./drawer/DevStatusLogSection";
import { CommentsThread } from "./drawer/CommentsThread";
import { BlockerBanner, BlockedByBanner } from "./drawer/Banners";

export function useTaskDrawerLink() {
  const [params, setParams] = useSearchParams();
  return {
    open: (id: string) => { params.set("task", id); setParams(params, { replace: false }); },
    close: () => { params.delete("task"); setParams(params, { replace: false }); },
    taskId: params.get("task"),
  };
}

export function TaskDrawer() {
  const { taskId, close } = useTaskDrawerLink();
  const [task, setTask] = useState<PmTask | null>(null);
  const [loading, setLoading] = useState(false);
  const users = useMockUsers();
  const { user } = useCurrentUser();
  const prevStatusRef = useRef<TaskStatus | null>(null);

  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    setLoading(true);
    supabase.from("pm_tasks").select("*").eq("id", taskId).maybeSingle().then(({ data }) => {
      const t = (data as any) ?? null;
      setTask(t);
      setLoading(false);
      if (t && user?.id) recordTaskActivity(user.id, t.project_id, t.id);
      if (t && t.status !== "blocked") prevStatusRef.current = t.status as TaskStatus;
    });
  }, [taskId, user?.id]);

  async function patch(p: Partial<PmTask>) {
    if (!task) return;
    try {
      const updated = await updateTask(task.id, p);
      setTask(updated);
      await logActivity({ task_id: task.id, project_id: task.project_id, user_id: user?.id, action: "task.updated", payload: p });
      emitTasksChanged();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "unknown error"}`);
    }
  }

  /** Blocker text change → flips status automatically. */
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

  const blockedByCount = useBlockedByCount(taskId ?? "");

  return (
    <Sheet open={!!taskId} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{loading ? "Loading…" : task ? "Task Detail" : "Not found"}</SheetTitle>
        </SheetHeader>

        {task && (
          <div className="space-y-4">
            {task.status === "blocked" && <BlockerBanner />}
            <BlockedByBanner count={blockedByCount} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={task.title} onChange={e => setTask({ ...task, title: e.target.value })}
                    onBlur={e => patch({ title: e.target.value })} className="text-base font-medium" />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea value={task.description ?? ""} rows={5}
                    onChange={e => setTask({ ...task, description: e.target.value })}
                    onBlur={e => patch({ description: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={task.status} onValueChange={(v: TaskStatus) => { if (v !== "blocked") prevStatusRef.current = v; patch({ status: v }); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Assignee</Label>
                  <Select value={task.assignee_id ?? "none"} onValueChange={v => patch({ assignee_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="none">Unassigned</SelectItem>
                      {users.filter(u => u.role !== "submitter").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={task.type} onValueChange={(v: TaskType) => patch({ type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {TASK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={task.priority} onValueChange={(v: TaskPriority) => patch({ priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Start</Label>
                    <DatePicker value={task.start_date} onChange={v => {
                      if (!v) { patch({ start_date: v }); return; }
                      const dur = Math.max(1, task.duration_days || 1);
                      const startD = new Date(v + "T00:00:00");
                      const endD = new Date(startD.getTime() + (dur - 1) * 86400000);
                      const end = endD.toISOString().slice(0, 10);
                      setTask({ ...task, start_date: v, due_date: end });
                      emitTaskDateProposed({ taskId: task.id, start: v, end });
                    }} />
                  </div>
                  <div>
                    <Label className="text-xs">Due</Label>
                    <DatePicker value={task.due_date} onChange={v => {
                      if (!v) { patch({ due_date: v }); return; }
                      const dur = Math.max(1, task.duration_days || 1);
                      const endD = new Date(v + "T00:00:00");
                      const startD = new Date(endD.getTime() - (dur - 1) * 86400000);
                      const start = startD.toISOString().slice(0, 10);
                      setTask({ ...task, start_date: start, due_date: v });
                      emitTaskDateProposed({ taskId: task.id, start, end: v });
                    }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Duration (days)</Label>
                  <Input type="number" min={1} value={task.duration_days}
                    onChange={e => setTask({ ...task, duration_days: Number(e.target.value) })}
                    onBlur={e => patch({ duration_days: Number(e.target.value) })} />
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Created {fmtDate(task.created_at?.slice(0, 10))} · Updated {fmtDate(task.updated_at?.slice(0, 10))}
                </div>
              </div>
            </div>

            {/* Dev blocker (existing functionality, dev tasks only) */}
            {task.type === "dev" && (
              <div className="border border-border rounded-lg p-3 bg-muted/30">
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3" /> Blocker
                </Label>
                <Textarea rows={2} value={task.dev_blocker ?? ""}
                  onChange={e => setTask({ ...task, dev_blocker: e.target.value })}
                  onBlur={e => patchBlocker(e.target.value)} />
                <div className="mt-2">
                  <Label className="text-xs">Environment notes</Label>
                  <Textarea rows={2} value={task.dev_environment ?? ""}
                    onChange={e => setTask({ ...task, dev_environment: e.target.value })}
                    onBlur={e => patch({ dev_environment: e.target.value })} />
                </div>
              </div>
            )}

            <SubtasksSection taskId={task.id} />
            <ChecklistSection taskId={task.id} />
            <AttachmentsSection taskId={task.id} projectId={task.project_id} />
            <DependenciesSection taskId={task.id} />
            <TimeTrackingSection taskId={task.id} />
            {task.type === "design" && <DesignRoundsSection taskId={task.id} />}
            {task.type === "dev" && <DevStatusLogSection task={task} />}
            <CommentsThread taskId={task.id} projectId={task.project_id} taskTitle={task.title} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

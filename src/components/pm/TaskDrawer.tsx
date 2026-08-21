import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { logActivity, updateTask, deleteTask } from "@/lib/pm/api";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { TASK_STATUSES, type PmTask, type TaskStatus } from "@/types/pm";
import { toast } from "sonner";
import { Maximize2, Send, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Drawer is now Quick Edit only.
 * Default click on a task navigates to the full workspace at /pm/tasks/:id.
 * Use `openQuick(id)` (shift-click / ⋯ menu) to open this drawer instead.
 */
export function useTaskDrawerLink() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  return {
    open: (id: string) => navigate(`/pm/tasks/${id}`),
    openQuick: (id: string) => { params.set("task", id); setParams(params, { replace: false }); },
    close: () => { params.delete("task"); setParams(params, { replace: false }); },
    taskId: params.get("task"),
  };
}

export function TaskDrawer() {
  const { taskId, close } = useTaskDrawerLink();
  const navigate = useNavigate();
  const [task, setTask] = useState<PmTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const users = useMockUsers();
  const { user } = useCurrentUser();

  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    setLoading(true);
    supabase.from("pm_tasks").select("*").eq("id", taskId).maybeSingle().then(({ data }) => {
      setTask((data as any) ?? null);
      setLoading(false);
    });
  }, [taskId]);

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

  async function postComment() {
    if (!task || !comment.trim() || !user) return;
    await supabase.from("pm_comments").insert({
      task_id: task.id, project_id: task.project_id, user_id: user.id,
      body: comment.trim(), mentions: [], pinned: false,
    } as any);
    setComment("");
    toast.success("Comment added");
  }

  function openFull() {
    if (!task) return;
    close();
    navigate(`/pm/tasks/${task.id}`);
  }

  const isMobile = useIsMobile();
  return (
    <Sheet open={!!taskId} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile
          ? "h-[92dvh] w-full sm:max-w-none rounded-t-2xl p-4 overflow-y-auto safe-bottom"
          : "w-full sm:max-w-md overflow-y-auto"}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>{loading ? "Loading…" : task ? "Quick Edit" : "Not found"}</SheetTitle>
        </SheetHeader>

        {task && (
          <div className="space-y-4">
            <Button className="w-full" onClick={openFull}>
              <Maximize2 className="h-4 w-4 mr-2" /> Open Full Task
            </Button>

            <div>
              <Label className="text-xs">Title</Label>
              <Input value={task.title} onChange={e => setTask({ ...task, title: e.target.value })}
                onBlur={e => patch({ title: e.target.value })} className="text-base font-medium" />
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={task.status} onValueChange={(v: TaskStatus) => patch({ status: v })}>
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
              <Label className="text-xs">Due date</Label>
              <DatePicker value={task.due_date} onChange={v => patch({ due_date: v })} />
            </div>

            <div className="border-t border-border pt-4">
              <Label className="text-xs">Quick comment</Label>
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
              />
              <Button size="sm" className="mt-2" onClick={postComment} disabled={!comment.trim()}>
                <Send className="h-3 w-3 mr-1" /> Post
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2">
              Need attachments, links, time tracking? <button onClick={openFull} className="underline text-primary">Open full task</button>
            </div>

            <div className="border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (!confirm("Delete this task? This cannot be undone.")) return;
                  try {
                    await deleteTask(task.id);
                    emitTasksChanged();
                    toast.success("Task deleted");
                    close();
                  } catch (err: any) {
                    toast.error(`Delete failed: ${err?.message ?? "unknown error"}`);
                  }
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete task
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

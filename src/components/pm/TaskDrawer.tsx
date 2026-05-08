import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { logActivity, updateTask } from "@/lib/pm/api";
import { TASK_STATUSES, TASK_TYPES, PRIORITIES, type PmTask, type TaskStatus, type TaskType, type TaskPriority } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";
import { Clock, Link2, AlertTriangle } from "lucide-react";

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
    const updated = await updateTask(task.id, p);
    setTask(updated);
    await logActivity({ task_id: task.id, project_id: task.project_id, user_id: user?.id, action: "task.updated", payload: p });
  }

  async function logTime(minutes: number) {
    if (!task || !user) return;
    await supabase.from("pm_time_entries").insert({ task_id: task.id, user_id: user.id, minutes, note: "" } as any);
    toast.success(`Logged ${minutes}m`);
  }

  return (
    <Sheet open={!!taskId} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{loading ? "Loading…" : task ? "Task Detail" : "Not found"}</SheetTitle>
        </SheetHeader>

        {task && (
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

              {task.type === "design" && (
                <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="text-sm font-semibold">Design</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Round</Label>
                      <Input type="number" value={task.design_round ?? 1}
                        onChange={e => setTask({ ...task, design_round: Number(e.target.value) })}
                        onBlur={e => patch({ design_round: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Approval</Label>
                      <Select value={task.design_approval ?? "pending"} onValueChange={v => patch({ design_approval: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 bg-popover">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="needs_revision">Needs revision</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {task.type === "dev" && (
                <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="text-sm font-semibold flex items-center gap-2">Dev <Link2 className="h-3.5 w-3.5" /></div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Blocker</Label>
                    <Textarea rows={2} value={task.dev_blocker ?? ""}
                      onChange={e => setTask({ ...task, dev_blocker: e.target.value })}
                      onBlur={e => patch({ dev_blocker: e.target.value, status: e.target.value ? "blocked" : task.status })} />
                  </div>
                  <div>
                    <Label className="text-xs">Environment notes</Label>
                    <Textarea rows={2} value={task.dev_environment ?? ""}
                      onChange={e => setTask({ ...task, dev_environment: e.target.value })}
                      onBlur={e => patch({ dev_environment: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Status log (append-only)</Label>
                    <div className="space-y-1 max-h-40 overflow-auto text-xs bg-background p-2 rounded">
                      {(task.dev_status_log || []).map((l, i) => (
                        <div key={i} className="border-b border-border/50 pb-1">
                          <span className="text-muted-foreground">{new Date(l.at).toLocaleString()}</span> — {l.note}
                        </div>
                      ))}
                      {!(task.dev_status_log || []).length && <div className="text-muted-foreground italic">No log entries yet.</div>}
                    </div>
                    <Input placeholder="Add log entry, press Enter…"
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          const note = e.currentTarget.value.trim();
                          const newLog = [...(task.dev_status_log || []), { at: new Date().toISOString(), note, by: user?.name }];
                          patch({ dev_status_log: newLog });
                          e.currentTarget.value = "";
                        }
                      }} className="mt-2" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={task.status} onValueChange={(v: TaskStatus) => patch({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
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
                  <Input type="date" value={task.start_date ?? ""} onChange={e => patch({ start_date: e.target.value || null })} />
                </div>
                <div>
                  <Label className="text-xs">Due</Label>
                  <Input type="date" value={task.due_date ?? ""} onChange={e => patch({ due_date: e.target.value || null })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Duration (days)</Label>
                <Input type="number" min={1} value={task.duration_days}
                  onChange={e => setTask({ ...task, duration_days: Number(e.target.value) })}
                  onBlur={e => patch({ duration_days: Number(e.target.value) })} />
              </div>

              <div className="border-t border-border pt-3">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Time tracking</Label>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => logTime(15)}>+15m</Button>
                  <Button size="sm" variant="outline" onClick={() => logTime(30)}>+30m</Button>
                  <Button size="sm" variant="outline" onClick={() => logTime(60)}>+1h</Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Created {fmtDate(task.created_at?.slice(0,10))} · Updated {fmtDate(task.updated_at?.slice(0,10))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

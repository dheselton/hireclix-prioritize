import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchTasks, fetchProjects, updateTask, logActivity } from "@/lib/pm/api";
import type { PmTask, PmProject, TaskStatus } from "@/types/pm";
import { TASK_STATUSES } from "@/types/pm";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { fmtDateShort } from "@/lib/pm/format";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COL_LABELS: Record<TaskStatus, string> = {
  unclaimed: "Unclaimed", claimed: "Claimed", in_progress: "In Progress", blocked: "Blocked",
  in_review: "In Review", approved: "Approved", complete: "Complete",
};

export default function Board() {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { user, role } = useCurrentUser();
  const drawer = useTaskDrawerLink();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const reload = async () => { setTasks(await fetchTasks()); setProjects(await fetchProjects()); };
  useEffect(() => { reload(); }, []);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const visible = useMemo(() => {
    if (showAll || role === "pm") return tasks;
    if (role === "designer") return tasks.filter(t => t.type === "design" || t.assignee_id === user?.id);
    if (role === "developer") return tasks.filter(t => t.type === "dev" || t.assignee_id === user?.id);
    return tasks.filter(t => t.assignee_id === user?.id);
  }, [tasks, showAll, role, user]);

  async function moveTo(taskId: string, status: TaskStatus) {
    const t = tasks.find(x => x.id === taskId);
    if (!t || t.status === status) return;
    await updateTask(taskId, { status });
    await logActivity({ task_id: taskId, project_id: t.project_id, user_id: user?.id, action: "task.status_changed", payload: { from: t.status, to: status } });
    toast.success(`Moved to ${COL_LABELS[status]}`);
    reload();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-unbounded">Board</h1>
          <p className="text-sm text-muted-foreground">Drag cards across columns to update status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="all" checked={showAll} onCheckedChange={setShowAll} />
          <Label htmlFor="all" className="text-sm">Show all (default: my role)</Label>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {TASK_STATUSES.map(s => {
          const items = visible.filter(t => t.status === s);
          return (
            <div key={s}
              className="flex-shrink-0 w-72 bg-muted/30 rounded-lg p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggingId) { moveTo(draggingId, s); setDraggingId(null); } }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="text-xs font-semibold uppercase tracking-wide">{COL_LABELS[s]}</div>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.map(t => {
                  const proj = projById.get(t.project_id);
                  const blocked = t.status === "blocked";
                  return (
                    <Card
                      key={t.id}
                      draggable
                      onDragStart={() => setDraggingId(t.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => drawer.open(t.id)}
                      className={cn("cursor-pointer hover:shadow-md transition", blocked && "border-red-500/60")}
                    >
                      <CardContent className="p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                          <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                        </div>
                        <div className="text-sm font-medium leading-tight">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground">{proj?.title}</div>
                        {blocked && t.dev_blocker && <div className="text-[11px] text-red-600 italic">⚠ {t.dev_blocker}</div>}
                        <div className="flex items-center justify-between pt-1">
                          <UserAvatar userId={t.assignee_id} size="xs" />
                          <span className="text-[11px] text-muted-foreground">{fmtDateShort(t.due_date)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDrawer />
    </div>
  );
}

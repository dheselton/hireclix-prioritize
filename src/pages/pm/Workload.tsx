import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMockUsers } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import type { PmTask, PmProject } from "@/types/pm";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { StatusPill } from "@/components/pm/StatusPill";
import { fmtDate } from "@/lib/pm/format";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { cn } from "@/lib/utils";

export default function Workload() {
  const users = useMockUsers().filter(u => u.role !== "submitter");
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const drawer = useTaskDrawerLink();

  useEffect(() => { fetchTasks().then(setTasks); fetchProjects().then(setProjects); }, []);
  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const today = new Date(); const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold font-unbounded">Team Workload</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => {
          const active = tasks.filter(t => t.assignee_id === u.id && t.status !== "complete" && t.status !== "approved");
          const thisWeek = active.filter(t => t.due_date && new Date(t.due_date) <= weekEnd);
          const cap = u.capacity_hours_per_week / 8; // tasks/week heuristic
          const ratio = thisWeek.length / Math.max(1, cap);
          const tone = ratio < 0.7 ? "bg-emerald-500" : ratio < 1.05 ? "bg-amber-500" : "bg-red-500";
          return (
            <Card key={u.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar userId={u.id} size="md" />
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>This week</span><span>{thisWeek.length} / {Math.round(cap)}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full", tone)} style={{ width: `${Math.min(100, ratio*100)}%` }} />
                  </div>
                </div>
                <div className="space-y-1 max-h-56 overflow-auto">
                  {active.slice(0, 8).map(t => (
                    <div key={t.id} className="text-xs p-2 rounded bg-muted/30 hover:bg-muted/60 cursor-pointer flex items-center justify-between gap-2"
                      onClick={() => drawer.open(t.id)}>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-muted-foreground truncate">{projById.get(t.project_id)?.title} · {fmtDate(t.due_date)}</div>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                  ))}
                  {!active.length && <div className="text-xs italic text-muted-foreground">No active tasks</div>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <TaskDrawer />
    </div>
  );
}

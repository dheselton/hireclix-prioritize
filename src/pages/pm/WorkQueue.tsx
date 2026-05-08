import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects, updateTask, logActivity } from "@/lib/pm/api";
import type { PmTask, PmProject } from "@/types/pm";
import { StatusPill } from "@/components/pm/StatusPill";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";

export default function WorkQueue() {
  const { user, role } = useCurrentUser();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const drawer = useTaskDrawerLink();

  const reload = async () => {
    const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
    setTasks(t); setProjects(p);
  };
  useEffect(() => { reload(); }, []);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const unclaimed = tasks.filter(t => t.status === "unclaimed");
  const mine = tasks.filter(t => t.assignee_id === user?.id && t.status !== "complete" && t.status !== "approved");
  const overdue = mine.filter(t => t.due_date && new Date(t.due_date) < new Date());
  const blocked = tasks.filter(t => t.status === "blocked");

  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  const todayTasks = mine.filter(t => t.due_date && new Date(t.due_date) <= today);
  const weekTasks = mine.filter(t => t.due_date && new Date(t.due_date) > today && new Date(t.due_date) <= weekEnd);
  const laterTasks = mine.filter(t => !t.due_date || new Date(t.due_date) > weekEnd);

  async function claim(t: PmTask) {
    if (!user) return;
    await updateTask(t.id, { assignee_id: user.id, status: "in_progress" });
    await logActivity({ task_id: t.id, project_id: t.project_id, user_id: user.id, action: "task.claimed" });
    toast.success(`Claimed: ${t.title}`);
    reload();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-unbounded">Good day, {user?.name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-sm text-muted-foreground">Viewing as <span className="font-medium">{role}</span></p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="My active" value={mine.length} />
        <StatCard icon={<Inbox className="h-4 w-4" />} label="Unclaimed" value={unclaimed.length} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Overdue (mine)" value={overdue.length} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Blocked total" value={blocked.length} />
      </div>

      {(overdue.length > 0 || blocked.length > 0) && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <div>
              {overdue.length > 0 && <span className="mr-3"><strong>{overdue.length}</strong> overdue</span>}
              {blocked.length > 0 && <span><strong>{blocked.length}</strong> blocked across all projects</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <Section title="Unclaimed Requests" count={unclaimed.length}>
        {unclaimed.length === 0 ? <Empty>No unclaimed work. </Empty> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unclaimed.map(t => {
              const proj = projById.get(t.project_id);
              return (
                <Card key={t.id} className="hover:shadow-md transition cursor-pointer" onClick={() => drawer.open(t.id)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                    </div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{proj?.title} · Due {fmtDate(t.due_date)}</div>
                    <Button size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); claim(t); }}>Claim</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="My Tasks" count={mine.length}>
        <div className="space-y-4">
          <Group label="Today" tasks={todayTasks} projById={projById} onOpen={drawer.open} />
          <Group label="This Week" tasks={weekTasks} projById={projById} onOpen={drawer.open} />
          <Group label="Later" tasks={laterTasks} projById={projById} onOpen={drawer.open} />
        </div>
      </Section>

      <TaskDrawer />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title} <span className="text-foreground/50">({count})</span></h2>
      {children}
    </div>
  );
}

function Group({ label, tasks, projById, onOpen }: { label: string; tasks: PmTask[]; projById: Map<string, PmProject>; onOpen: (id: string) => void }) {
  if (!tasks.length) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="space-y-1">
        {tasks.map(t => {
          const proj = projById.get(t.project_id);
          return (
            <Card key={t.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => onOpen(t.id)}>
              <CardContent className="p-3 flex items-center gap-3">
                <UserAvatar userId={t.assignee_id} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{proj?.title} · {fmtDate(t.due_date)}</div>
                </div>
                <StatusPill status={t.status} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground italic py-4">{children}</div>;
}

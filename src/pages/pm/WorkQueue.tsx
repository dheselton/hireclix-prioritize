import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import type { PmTask, PmProject } from "@/types/pm";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { ViewToggle } from "@/components/pm/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { TaskListView } from "@/components/pm/collections/TaskListView";
import { TaskGridView } from "@/components/pm/collections/TaskGridView";

export default function WorkQueue() {
  const { user, role } = useCurrentUser();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("workQueue", "list");

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-unbounded">Good day, {user?.name?.split(" ")[0] ?? "there"}</h1>
          <p className="text-sm text-muted-foreground">Viewing as <span className="font-medium">{role}</span></p>
        </div>
        <ViewToggle value={mode} onChange={(m) => setMode(m as any)} />
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
        {mode === "list"
          ? <TaskListView tasks={unclaimed} projects={projById} onOpen={drawer.open} onChanged={reload} />
          : <TaskGridView tasks={unclaimed} projects={projById} onOpen={drawer.open} onChanged={reload} />}
      </Section>

      <Section title="My Tasks" count={mine.length}>
        {mode === "list"
          ? <TaskListView tasks={mine} projects={projById} onOpen={drawer.open} onChanged={reload} />
          : <TaskGridView tasks={mine} projects={projById} onOpen={drawer.open} onChanged={reload} />}
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title} <span className="text-foreground/50">({count})</span>
      </h2>
      {children}
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import type { PmTask, PmProject } from "@/types/pm";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { useViewMode } from "@/hooks/useViewMode";
import { TaskListView } from "@/components/pm/collections/TaskListView";
import { TaskGridView } from "@/components/pm/collections/TaskGridView";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { applyTaskChips } from "@/lib/pm/filters";
import { useTrackMode } from "@/hooks/useTrackMode";
import { applyTaskTrack, userTrack } from "@/lib/pm/track";

export default function WorkQueue() {
  const { user, role } = useCurrentUser();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("workQueue", "list");
  const { isMe } = useMeMode();
  const chips = useChipFilters("workQueue");
  const { mode: trackMode } = useTrackMode();
  const myTrack = userTrack(user);

  const reload = async () => {
    const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
    setTasks(t); setProjects(p);
  };
  useEffect(() => { reload(); }, []);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const tracked = useMemo(() => applyTaskTrack(tasks, trackMode, myTrack), [tasks, trackMode, myTrack]);

  const unclaimed = tracked.filter(t => t.status === "unclaimed");
  const mineRaw = tracked.filter(t => t.assignee_id === user?.id && t.status !== "complete" && t.status !== "approved");
  const overdue = mineRaw.filter(t => t.due_date && new Date(t.due_date) < new Date());
  const blocked = tracked.filter(t => t.status === "blocked");

  // Me Mode applies only to "My Tasks" — Unclaimed always shown.
  const mine = useMemo(
    () => applyTaskChips(isMe ? mineRaw.filter(t => t.assignee_id === user?.id) : mineRaw, chips.active, user?.id),
    [mineRaw, chips.active, user?.id, isMe],
  );
  const unclaimedFiltered = useMemo(
    () => applyTaskChips(unclaimed, chips.active, user?.id),
    [unclaimed, chips.active, user?.id],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <CollectionToolbar
        title={`Good day, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle={<>Viewing as <span className="font-medium">{role}</span></>}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        chipState={chips}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="My active" value={mineRaw.length} />
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

      <Section title="Unclaimed Requests — visible to all" count={unclaimedFiltered.length}>
        {mode === "list"
          ? <TaskListView tasks={unclaimedFiltered} projects={projById} onOpen={drawer.open} onChanged={reload} />
          : <TaskGridView tasks={unclaimedFiltered} projects={projById} onOpen={drawer.open} onChanged={reload} />}
      </Section>

      <Section title={isMe ? "My Tasks" : "My Tasks"} count={mine.length}>
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

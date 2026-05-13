import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmTask, PmProject, TaskType } from "@/types/pm";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { useViewMode } from "@/hooks/useViewMode";
import { TaskListView } from "@/components/pm/collections/TaskListView";
import { TaskGridView } from "@/components/pm/collections/TaskGridView";
import { TaskKanban } from "@/components/pm/TaskKanban";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { applyTaskChips, applyTaskTypes } from "@/lib/pm/filters";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";

// Tasks that are "naturally" in this role's lane, used for unclaimed buckets.
const ROLE_LANE: Record<string, TaskType[]> = {
  designer: ["design", "content"],
  developer: ["dev", "qa"],
  pm: ["review", "approval"],
  strategist: ["strategy", "research"],
  analyst: ["analytics", "reporting"],
  submitter: [],
};

export default function WorkQueue() {
  const { user, role } = useCurrentUser();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("workQueue", "list");
  const { isMe } = useMeMode();
  const chips = useChipFilters("workQueue");
  const { types } = useTypeFilter("workQueue");
  const [showAllUnclaimed, setShowAllUnclaimed] = useState(false);

  const reload = async () => {
    const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
    setTasks(t); setProjects(p);
  };
  useEffect(() => { reload(); }, []);
  useTasksChanged(reload);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Pipeline: type-filter (role default) -> chips, then sectioning. Me Mode is applied within each section.
  const filtered = useMemo(() => {
    let v = applyTaskTypes(tasks, types);
    v = applyTaskChips(v, chips.active, user?.id);
    return v;
  }, [tasks, types, chips.active, user?.id]);

  const meId = user?.id ?? null;
  const lane = ROLE_LANE[role ?? "submitter"] ?? [];
  const inLane = (t: PmTask) => lane.length === 0 || lane.includes(t.type);
  const active = (t: PmTask) => t.status !== "complete" && t.status !== "approved";

  // Stats — computed off the role-filtered set for relevance.
  const myActiveCount = filtered.filter(t => t.assignee_id === meId && active(t)).length;
  const unclaimedCount = filtered.filter(t => t.status === "unclaimed").length;
  const overdueMine = filtered.filter(t =>
    t.assignee_id === meId && active(t) && t.due_date && new Date(t.due_date) < new Date()
  ).length;
  const blockedCount = filtered.filter(t => t.status === "blocked").length;

  // Sections per role
  const sections = useMemo(() => {
    const list: { key: string; title: string; subtitle?: string; tasks: PmTask[]; emptyHint?: string }[] = [];

    const minePred = (extra: (t: PmTask) => boolean) =>
      filtered.filter(t => t.assignee_id === meId && extra(t));

    if (role === "pm") {
      list.push({
        key: "approvals",
        title: "Approvals waiting on me",
        tasks: filtered.filter(t => t.status === "in_review" && (isMe ? t.assignee_id === meId : true)),
      });
      list.push({
        key: "my-pm",
        title: "My coordination tasks",
        tasks: minePred(active),
      });
      list.push({
        key: "blocked",
        title: "Blocked across projects",
        tasks: filtered.filter(t => t.status === "blocked"),
      });
      list.push({
        key: "unclaimed",
        title: "Unclaimed requests",
        tasks: filtered.filter(t => t.status === "unclaimed" && (showAllUnclaimed || inLane(t))),
      });
    } else if (role === "designer") {
      list.push({
        key: "my-design",
        title: "My design work",
        tasks: minePred(t => active(t) && (lane.includes(t.type))),
      });
      list.push({
        key: "in-review",
        title: "In review — needs my attention",
        tasks: filtered.filter(t =>
          t.status === "in_review" &&
          lane.includes(t.type) &&
          (isMe ? (t.assignee_id === meId || t.created_by === meId) : true)
        ),
      });
      list.push({
        key: "unclaimed",
        title: "Unclaimed design requests",
        tasks: filtered.filter(t => t.status === "unclaimed" && (showAllUnclaimed || inLane(t))),
      });
    } else if (role === "developer") {
      list.push({
        key: "my-dev",
        title: "My dev tasks",
        tasks: minePred(t => active(t) && lane.includes(t.type)),
      });
      list.push({
        key: "blocked",
        title: "Blocked — needs resolution",
        tasks: filtered.filter(t =>
          t.status === "blocked" &&
          lane.includes(t.type) &&
          (isMe ? t.assignee_id === meId : true)
        ),
      });
      list.push({
        key: "unclaimed",
        title: "Unclaimed dev tasks",
        tasks: filtered.filter(t => t.status === "unclaimed" && (showAllUnclaimed || inLane(t))),
      });
    } else if (role === "strategist" || role === "analyst") {
      const teamLabel = role === "strategist" ? "strategy" : "analytics";
      list.push({
        key: "mine",
        title: `My ${teamLabel} work`,
        tasks: minePred(t => active(t) && lane.includes(t.type)),
      });
      list.push({
        key: "unclaimed",
        title: `Unclaimed ${teamLabel} tasks`,
        tasks: filtered.filter(t => t.status === "unclaimed" && (showAllUnclaimed || inLane(t))),
      });
    } else {
      // submitter / fallback
      list.push({
        key: "mine",
        title: "My requests",
        tasks: filtered.filter(t => t.created_by === meId),
      });
      list.push({
        key: "unclaimed",
        title: "Unclaimed requests",
        tasks: filtered.filter(t => t.status === "unclaimed"),
      });
    }
    return list;
  }, [filtered, role, meId, isMe, lane, showAllUnclaimed]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <UnclaimedBanner hideCta />
      <CollectionToolbar
        title={`Good day, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle={<>Viewing as <span className="font-medium capitalize">{role}</span></>}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        modes={["list", "grid", "kanban"]}
        chipState={chips}
        typeFilterPage="workQueue"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-4 w-4" />} label="My active" value={myActiveCount} />
        <StatCard icon={<Inbox className="h-4 w-4" />} label="Unclaimed" value={unclaimedCount} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Overdue (mine)" value={overdueMine} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Blocked" value={blockedCount} />
      </div>

      {(overdueMine > 0 || blockedCount > 0) && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <div>
              {overdueMine > 0 && <span className="mr-3"><strong>{overdueMine}</strong> overdue</span>}
              {blockedCount > 0 && <span><strong>{blockedCount}</strong> blocked across all projects</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.map(s => (
        <Section
          key={s.key}
          title={s.title}
          count={s.tasks.length}
          extra={s.key === "unclaimed" && lane.length > 0 ? (
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => setShowAllUnclaimed(v => !v)}>
              {showAllUnclaimed ? "Show only my lane" : "Show all unclaimed"}
            </Button>
          ) : null}
        >
          {mode === "list" && (
            <TaskListView tasks={s.tasks} projects={projById} onOpen={drawer.open} onChanged={reload} />
          )}
          {mode === "grid" && (
            <TaskGridView tasks={s.tasks} projects={projById} onOpen={drawer.open} onChanged={reload} />
          )}
          {mode === "kanban" && (
            <TaskKanban tasks={s.tasks} projects={projById} onOpen={drawer.open} onChanged={reload} />
          )}
        </Section>
      ))}

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

function Section({ title, count, children, extra }:
  { title: string; count: number; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title} <span className="text-foreground/50">({count})</span>
        </h2>
        {extra}
      </div>
      {children}
    </div>
  );
}

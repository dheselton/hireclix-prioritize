import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Clock, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
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
import { ProjectWorkGrid } from "@/components/pm/collections/ProjectWorkGrid";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { buildQueueLink } from "@/lib/pm/links";
import { supabase } from "@/integrations/supabase/client";

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
  const [pmProjectIds, setPmProjectIds] = useState<Set<string>>(new Set());
  const [latestFormSlug, setLatestFormSlug] = useState<string | null>(null);
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("workQueue", "projects");
  const { isMe } = useMeMode();
  const chips = useChipFilters("workQueue");
  const { types } = useTypeFilter("workQueue");
  const typesKey = useMemo(() => [...types].sort().join(","), [types]);
  const [showAllUnclaimed, setShowAllUnclaimed] = useState(false);

  const reload = async () => {
    const [t, p] = await Promise.all([
      fetchTasks(undefined, { types: [...types] }),
      fetchProjects(),
    ]);
    setTasks(t); setProjects(p);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [typesKey]);
  useTasksChanged(reload);

  // PMs: find projects where I'm the PM, used for "Approvals Waiting on Me".
  useEffect(() => {
    if (role !== "pm" || !user?.id) { setPmProjectIds(new Set()); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("pm_project_members")
        .select("project_id, role")
        .eq("user_id", user.id);
      if (!active) return;
      const ids = new Set(
        (data || [])
          .filter((r: any) => String(r.role).toLowerCase() === "pm")
          .map((r: any) => r.project_id as string)
      );
      setPmProjectIds(ids);
    })();
    return () => { active = false; };
  }, [role, user?.id]);

  // Submitters: fetch the most recent published form for the banner link.
  useEffect(() => {
    if (role !== "submitter") { setLatestFormSlug(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("pm_forms")
        .select("shareable_slug")
        .not("shareable_slug", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setLatestFormSlug((data as any)?.shareable_slug ?? null);
    })();
    return () => { active = false; };
  }, [role]);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const workType = useWorkTypeFilter("workQueue");

  // Pipeline: type-filter (role default) -> chips -> work-type, then sectioning. Me Mode is applied within each section.
  const filtered = useMemo(() => {
    let v = applyTaskTypes(tasks, types);
    v = applyTaskChips(v, chips.active, user?.id);
    if (workType.value !== "all") {
      v = v.filter(t => {
        const wt = (projById.get(t.project_id) as any)?.work_type ?? "project";
        return wt === workType.value;
      });
    }
    return v;
  }, [tasks, types, chips.active, user?.id, workType.value, projById]);

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

  // Sections per role — split by parent project work_type.
  const isRequestTask = (t: PmTask) => (projById.get(t.project_id) as any)?.work_type === "request";
  const isProjectTask = (t: PmTask) => {
    const wt = (projById.get(t.project_id) as any)?.work_type;
    return wt === "project" || wt == null;
  };

  const sections = useMemo(() => {
    const list: { key: string; title: string; subtitle?: string; tasks: PmTask[]; emptyHint?: string }[] = [];

    const minePred = (extra: (t: PmTask) => boolean) =>
      filtered.filter(t => t.assignee_id === meId && extra(t));

    if (role === "pm") {
      list.push({
        key: "unclaimed-requests",
        title: "Unclaimed Requests",
        tasks: filtered.filter(t => t.status === "unclaimed" && isRequestTask(t)),
      });
      list.push({
        key: "unclaimed-projects",
        title: "Unclaimed Project Tasks",
        tasks: filtered.filter(t => t.status === "unclaimed" && isProjectTask(t)),
      });
      list.push({
        key: "active-projects",
        title: "Active Projects",
        tasks: filtered.filter(t => active(t) && isProjectTask(t)),
      });
      list.push({
        key: "my-work",
        title: "My Work",
        tasks: minePred(active),
      });
      list.push({
        key: "approvals",
        title: "Approvals Waiting on Me",
        tasks: filtered.filter(t =>
          t.status === "in_review" &&
          (pmProjectIds.size === 0 ? true : pmProjectIds.has(t.project_id))
        ),
      });
    } else if (role === "designer" || role === "developer") {
      const laneType = role === "designer" ? "design" : "dev";
      const inMyLane = (t: PmTask) => t.type === laneType;
      list.push({
        key: "unclaimed-lane",
        title: "Unclaimed in my lane",
        tasks: filtered.filter(t => t.status === "unclaimed" && (showAllUnclaimed || inMyLane(t))),
      });
      list.push({
        key: "quick-tasks",
        title: "Quick Tasks (Requests)",
        tasks: filtered.filter(t => isRequestTask(t) && (t.assignee_id === meId || t.status === "unclaimed")),
      });
      list.push({
        key: "project-work",
        title: "Project Work",
        tasks: minePred(t => active(t) && isProjectTask(t) && inMyLane(t)),
      });
      if (role === "designer") {
        list.push({
          key: "in-review",
          title: "In Review — Needs My Attention",
          tasks: filtered.filter(t => t.status === "in_review" && t.assignee_id === meId),
        });
      } else {
        list.push({
          key: "blocked",
          title: "Blocked — Needs Resolution",
          tasks: filtered.filter(t => t.status === "blocked" && t.assignee_id === meId),
        });
      }
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
      list.push({
        key: "mine",
        title: "Requests I've Submitted",
        tasks: filtered.filter(t => t.created_by === meId),
      });
    }
    return list;
  }, [filtered, role, meId, lane, showAllUnclaimed, pmProjectIds, projById]);

  const isSubmitter = role === "submitter";

  // Scroll to the section specified by ?section= once data has loaded.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("section");
    if (!target || !sections.length) return;
    const el = document.getElementById(`section-${target}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/40", "rounded-md");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40", "rounded-md"), 1800);
    }
    params.delete("section");
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
  }, [sections.length]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {!isSubmitter && <UnclaimedBanner hideCta />}

      <CollectionToolbar
        title={`Good day, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle={<>Viewing as <span className="font-medium capitalize">{role}</span></>}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        modes={["projects", "list", "grid", "kanban"]}
        chipState={chips}
        typeFilterPage="workQueue"
        actions={!isSubmitter ? <WorkTypeFilterToggle value={workType.value} onChange={workType.set} /> : undefined}
      />

      {isSubmitter && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold">Need something new?</div>
              <div className="text-muted-foreground">Submit a request through one of our intake forms.</div>
            </div>
            {latestFormSlug ? (
              <Button asChild>
                <a href={`/f/${latestFormSlug}`}>
                  Submit a new request <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            ) : (
              <Button disabled variant="outline">No forms available</Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isSubmitter && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard to={buildQueueLink({ chips: ["assigned_to_me"] })} icon={<Clock className="h-4 w-4" />} label="My active" value={myActiveCount} />
            <StatCard to={buildQueueLink({ section: role === "pm" ? "unclaimed-projects" : "unclaimed-lane" })} icon={<Inbox className="h-4 w-4" />} label="Unclaimed" value={unclaimedCount} />
            <StatCard to={buildQueueLink({ chips: ["assigned_to_me", "overdue"] })} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Overdue (mine)" value={overdueMine} />
            <StatCard to={buildQueueLink({ chips: ["blocked"] })} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Blocked" value={blockedCount} />
          </div>

          {(overdueMine > 0 || blockedCount > 0) && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div className="flex items-center gap-3">
                  {overdueMine > 0 && (
                    <Link to={buildQueueLink({ chips: ["assigned_to_me", "overdue"] })} className="hover:underline">
                      <strong>{overdueMine}</strong> overdue
                    </Link>
                  )}
                  {blockedCount > 0 && (
                    <Link to={buildQueueLink({ chips: ["blocked"] })} className="hover:underline">
                      <strong>{blockedCount}</strong> blocked across all projects
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {sections.map(s => (
        <Section
          key={s.key}
          id={`section-${s.key}`}
          title={s.title}
          count={s.tasks.length}
          extra={s.key === "unclaimed-lane" && (role === "designer" || role === "developer") ? (
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => setShowAllUnclaimed(v => !v)}>
              {showAllUnclaimed ? "Show only my lane" : "Show all unclaimed"}
            </Button>
          ) : null}
        >
          {mode === "projects" && (
            <ProjectWorkGrid tasks={s.tasks} projects={projById} meId={meId} onOpenTask={drawer.open} onChanged={reload} />
          )}
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

function Section({ title, count, children, extra, id }:
  { title: string; count: number; children: React.ReactNode; extra?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
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

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to?: string }) {
  const body = (
    <Card className={to ? "hover:shadow-md hover:border-foreground/20 transition cursor-pointer h-full" : "h-full"}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
  if (!to) return body;
  return <Link to={to} className="block">{body}</Link>;
}


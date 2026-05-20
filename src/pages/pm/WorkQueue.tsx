import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Clock, AlertTriangle, CheckCircle2, ArrowRight, Zap, FolderKanban, FolderOpen } from "lucide-react";
import { CreateWorkDialog } from "@/components/pm/CreateWorkDialog";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmTask, PmProject, TaskType } from "@/types/pm";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useChipFilters } from "@/hooks/useChipFilters";
import { applyTaskChips, applyTaskTypes } from "@/lib/pm/filters";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { useMeMode } from "@/hooks/useMeMode";
import { useWorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { buildQueueLink } from "@/lib/pm/links";
import { supabase } from "@/integrations/supabase/client";
import { CollapsibleSection } from "@/components/pm/CollapsibleSection";
import { TaskListByType } from "@/components/pm/workqueue/TaskListByType";
import { ProjectHealthList } from "@/components/pm/workqueue/ProjectHealthList";
import { BlockedTaskCard } from "@/components/pm/workqueue/BlockedTaskCard";

// Tasks that are "naturally" in this role's lane
const ROLE_LANE: Record<string, TaskType[]> = {
  designer: ["design", "content"],
  developer: ["dev", "qa"],
  pm: [], // PMs see all lanes
  strategist: ["strategy", "research"],
  analyst: ["analytics", "reporting"],
  submitter: [],
};

const active = (t: PmTask) => t.status !== "complete" && t.status !== "approved";

export default function WorkQueue() {
  const { user, role } = useCurrentUser();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [phaseNames, setPhaseNames] = useState<Map<string, string>>(new Map());
  const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());
  const [pmProjectIds, setPmProjectIds] = useState<Set<string>>(new Set());
  const [latestFormSlug, setLatestFormSlug] = useState<string | null>(null);
  const drawer = useTaskDrawerLink();
  const chips = useChipFilters("workQueue");
  const { types } = useTypeFilter("workQueue");
  const typesKey = useMemo(() => [...types].sort().join(","), [types]);
  const [createOpen, setCreateOpen] = useState<null | "request" | "project">(null);
  const workType = useWorkTypeFilter("workQueue");
  const { isMe } = useMeMode();

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

  // Lookup tables for cards
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: cs }, { data: ph }] = await Promise.all([
        supabase.from("clients").select("id, name"),
        supabase.from("pm_project_phases").select("id, name"),
      ]);
      if (cancelled) return;
      setClientNames(new Map((cs ?? []).map((r: any) => [r.id, r.name])));
      setPhaseNames(new Map((ph ?? []).map((r: any) => [r.id, r.name])));
    })();
    return () => { cancelled = true; };
  }, []);

  // PMs: find projects where I'm the PM
  useEffect(() => {
    if (role !== "pm" || !user?.id) { setPmProjectIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pm_project_members")
        .select("project_id, role")
        .eq("user_id", user.id);
      if (cancelled) return;
      const ids = new Set(
        (data || [])
          .filter((r: any) => String(r.role).toLowerCase() === "pm")
          .map((r: any) => r.project_id as string)
      );
      setPmProjectIds(ids);
    })();
    return () => { cancelled = true; };
  }, [role, user?.id]);

  // Submitters: latest form for banner
  useEffect(() => {
    if (role !== "submitter") { setLatestFormSlug(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pm_forms")
        .select("shareable_slug")
        .not("shareable_slug", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setLatestFormSlug((data as any)?.shareable_slug ?? null);
    })();
    return () => { cancelled = true; };
  }, [role]);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const isRequestTask = (t: PmTask) => (projById.get(t.project_id) as any)?.work_type === "request";
  const isProjectTask = (t: PmTask) => {
    const wt = (projById.get(t.project_id) as any)?.work_type;
    return wt === "project" || wt == null;
  };

  // Pipeline: type-filter -> chips -> work-type
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
  // In "All" mode every role sees every lane (admin behavior); lanes only restrict in "Me" mode.
  const inLane = (t: PmTask) => !isMe || lane.length === 0 || lane.includes(t.type);

  const isSubmitter = role === "submitter";
  const isPM = role === "pm";

  // --- Buckets -------------------------------------------------------------
  const unclaimedRequests = useMemo(
    () => filtered.filter(t => t.status === "unclaimed" && isRequestTask(t) && (isPM || inLane(t))),
    [filtered, isPM, lane, projById],
  );
  const unclaimedProjectTasks = useMemo(
    () => filtered.filter(t => t.status === "unclaimed" && isProjectTask(t) && (isPM || inLane(t))),
    [filtered, isPM, lane, projById],
  );

  const myActive = useMemo(
    () => filtered.filter(t => t.assignee_id === meId && active(t)),
    [filtered, meId],
  );
  const myQuickHits = useMemo(() => myActive.filter(isRequestTask), [myActive, projById]);
  const myProjectWork = useMemo(() => myActive.filter(isProjectTask), [myActive, projById]);

  const myBlocked = useMemo(
    () => filtered.filter(t => t.status === "blocked" && t.assignee_id === meId),
    [filtered, meId],
  );

  const waitingReview = useMemo(() => {
    if (isPM) {
      return filtered.filter(t =>
        t.status === "in_review" &&
        (pmProjectIds.size === 0 ? true : pmProjectIds.has(t.project_id))
      );
    }
    return filtered.filter(t => t.status === "in_review" && t.created_by === meId);
  }, [filtered, isPM, meId, pmProjectIds]);

  const mySubmitted = useMemo(
    () => filtered.filter(t => t.created_by === meId),
    [filtered, meId],
  );

  // --- Stats ---------------------------------------------------------------
  const stats = useMemo(() => {
    if (isPM) {
      const activePmTasks = filtered.filter(t => active(t) && (pmProjectIds.size === 0 || pmProjectIds.has(t.project_id)));
      const projIds = new Set(activePmTasks.map(t => t.project_id));
      return {
        activeRequests: filtered.filter(t => t.status === "unclaimed" && isRequestTask(t)).length,
        activeProjects: projIds.size,
        unclaimed: filtered.filter(t => t.status === "unclaimed").length,
        blockers: filtered.filter(t => t.status === "blocked" && (pmProjectIds.size === 0 || pmProjectIds.has(t.project_id))).length,
      };
    }
    const myActiveSet = filtered.filter(t => t.assignee_id === meId && active(t));
    const myProjects = new Set(myActiveSet.filter(isProjectTask).map(t => t.project_id));
    return {
      activeRequests: myActiveSet.filter(isRequestTask).length,
      activeProjects: myProjects.size,
      unclaimed: filtered.filter(t => t.status === "unclaimed" && inLane(t)).length,
      blockers: myBlocked.length,
    };
  }, [filtered, isPM, meId, pmProjectIds, lane, projById, myBlocked]);

  // Scroll to ?section= once data loads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("section");
    if (!target) return;
    const el = document.getElementById(`section-${target}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/40", "rounded-lg");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40", "rounded-lg"), 1800);
    }
    params.delete("section");
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
  }, [tasks.length]);

  // --- Render --------------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {!isSubmitter && <UnclaimedBanner hideCta />}

      <CollectionToolbar
        title={`Good day, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle={<>Viewing as <span className="font-medium capitalize">{role}</span></>}
        chipState={chips}
        typeFilterPage="workQueue"
        actions={!isSubmitter ? (
          <div className="flex items-center gap-2">
            <WorkTypeFilterToggle value={workType.value} onChange={workType.set} />
            <Button size="sm" variant="outline" onClick={() => setCreateOpen("request")}>
              <Zap className="h-4 w-4 mr-1" /> Quick Request
            </Button>
            <Button size="sm" onClick={() => setCreateOpen("project")}>
              <FolderKanban className="h-4 w-4 mr-1" /> Project
            </Button>
          </div>
        ) : undefined}
      />

      {isSubmitter ? (
        <>
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

          <CollapsibleSection
            id="section-my-requests"
            title="My Requests"
            count={mySubmitted.length}
            storageKey="pm.wq.mySubmitted"
          >
            <TaskListByType
              variant="request"
              tasks={mySubmitted}
              projects={projById}
              phaseNames={phaseNames}
              clientNames={clientNames}
              onOpen={drawer.open}
              onChanged={reload}
              emptyHint="You haven't submitted any requests yet."
            />
          </CollapsibleSection>
        </>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              to={isPM
                ? buildQueueLink({ chips: ["unclaimed"], workType: "request", section: "inbox-requests" })
                : buildQueueLink({ chips: ["assigned_to_me"], workType: "request", section: "quick-hits" })}
              icon={<Zap className="h-4 w-4" />}
              label={isPM ? "Unclaimed Requests" : "Active Requests"}
              value={stats.activeRequests}
            />
            <StatCard
              to={isPM
                ? buildQueueLink({ workType: "project", section: "project-health" })
                : buildQueueLink({ chips: ["assigned_to_me"], workType: "project", section: "project-work" })}
              icon={<FolderOpen className="h-4 w-4" />}
              label="Active Projects"
              value={stats.activeProjects}
            />
            <StatCard
              to={buildQueueLink({ chips: ["unclaimed"], section: "inbox" })}
              icon={<Inbox className="h-4 w-4" />}
              label="Total Unclaimed"
              value={stats.unclaimed}
            />
            <StatCard
              to={buildQueueLink({ chips: ["blocked"], section: "blocked" })}
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              label="Blockers"
              value={stats.blockers}
            />

          </div>

          {/* BAND 1 — INBOX */}
          <CollapsibleSection
            id="section-inbox"
            title="Inbox — Unclaimed Work"
            count={unclaimedRequests.length + unclaimedProjectTasks.length}
            storageKey="pm.wq.inbox"
            accent="amber"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div id="section-inbox-requests" className="scroll-mt-24">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" /> Quick Requests Inbox
                  <span className="text-foreground/40 font-normal">({unclaimedRequests.length})</span>
                </div>
                <TaskListByType
                  variant="request"
                  tasks={unclaimedRequests}
                  projects={projById}
                  phaseNames={phaseNames}
                  clientNames={clientNames}
                  onOpen={drawer.open}
                  onChanged={reload}
                  emptyHint={isPM ? "No unclaimed requests." : "No unclaimed requests in your lane."}
                />
              </div>
              <div id="section-inbox-projects" className="scroll-mt-24">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5" /> New Project Tasks
                  <span className="text-foreground/40 font-normal">({unclaimedProjectTasks.length})</span>
                </div>
                <TaskListByType
                  variant="project"
                  tasks={unclaimedProjectTasks}
                  projects={projById}
                  phaseNames={phaseNames}
                  clientNames={clientNames}
                  onOpen={drawer.open}
                  onChanged={reload}
                  emptyHint={isPM ? "No unclaimed project tasks." : "No unclaimed project tasks in your lane."}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* BAND 2 — MY ACTIVE WORK */}
          <CollapsibleSection
            id="section-active"
            title="My Active Work"
            count={isPM ? myProjectWork.length : myActive.length}
            storageKey="pm.wq.active"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {isPM ? (
                <div id="section-project-health" className="scroll-mt-24">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Project Health
                  </div>
                  <ProjectHealthList projects={projects} tasks={tasks} projectIds={pmProjectIds} />
                </div>
              ) : (
                <div id="section-quick-hits" className="scroll-mt-24">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" /> Quick Hits
                    <span className="text-foreground/40 font-normal">({myQuickHits.length})</span>
                  </div>
                  <TaskListByType
                    variant="request"
                    tasks={myQuickHits}
                    projects={projById}
                    phaseNames={phaseNames}
                    clientNames={clientNames}
                    onOpen={drawer.open}
                    onChanged={reload}
                    emptyHint="No active requests assigned to you."
                  />
                </div>
              )}

              <div id="section-project-work" className="scroll-mt-24">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5" /> Project Work
                  <span className="text-foreground/40 font-normal">({myProjectWork.length})</span>
                </div>
                <TaskListByType
                  variant="project"
                  tasks={myProjectWork}
                  projects={projById}
                  phaseNames={phaseNames}
                  clientNames={clientNames}
                  onOpen={drawer.open}
                  onChanged={reload}
                  emptyHint="No project tasks assigned to you."
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* BAND 3 — BLOCKED & REVIEW */}
          <CollapsibleSection
            id="section-blocked-review"
            title="Blocked & Review"
            count={myBlocked.length + waitingReview.length}
            storageKey="pm.wq.blockedReview"
            accent={myBlocked.length > 0 ? "red" : "default"}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div id="section-blocked" className="scroll-mt-24">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Blocked Work
                  <span className="text-foreground/40 font-normal">({myBlocked.length})</span>
                </div>
                {myBlocked.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed rounded-md">
                    Nothing blocked. Keep going.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myBlocked.map(t => (
                      <BlockedTaskCard
                        key={t.id}
                        task={t}
                        project={projById.get(t.project_id)}
                        clientName={clientNames.get(projById.get(t.project_id)?.client_id ?? "") ?? null}
                        onOpen={drawer.open}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div id="section-review" className="scroll-mt-24">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Waiting for Review
                  <span className="text-foreground/40 font-normal">({waitingReview.length})</span>
                </div>
                <TaskListByType
                  variant="project"
                  tasks={waitingReview}
                  projects={projById}
                  phaseNames={phaseNames}
                  clientNames={clientNames}
                  onOpen={drawer.open}
                  onChanged={reload}
                  emptyHint={isPM ? "No approvals waiting on you." : "Nothing of yours is pending review."}
                />
              </div>
            </div>
          </CollapsibleSection>
        </>
      )}

      <TaskDrawer />
      <CreateWorkDialog
        open={createOpen !== null}
        onOpenChange={(v) => { if (!v) setCreateOpen(null); }}
        initialStep={createOpen ?? "select"}
        onCreated={reload}
      />
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

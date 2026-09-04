import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { StatusPill } from "@/components/pm/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDate } from "@/lib/pm/format";
import { isHardOverdue } from "@/lib/pm/dueState";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { applyTaskChips, applyTaskTypes, matchesWorkState, WORK_STATE_FILTERS, WORK_STATE_LABEL } from "@/lib/pm/filters";
import { useTaskAssigneesMap } from "@/lib/pm/assignees";
import { useTypeFilter } from "@/hooks/useTypeFilter";
import { ChevronDown } from "lucide-react";
import { ProjectHealthList } from "@/components/pm/workqueue/ProjectHealthList";
import { useProjectTeamsMap } from "@/lib/pm/projectTeam";
import type { PmRole } from "@/types/pm";
import { EMPTY_PROJECTS, EMPTY_TASKS, useProjectsQuery, useTasksQuery } from "@/lib/pm/queries";
import { WorkGridSkeleton, WorkLoadError } from "@/components/pm/WorkLoadingState";

/** Lead roles that get the project health roll-up on this page. */
const HEALTH_ROLES: PmRole[] = ["pm", "csm", "ba", "tech_lead"];
const HEALTH_OPEN_KEY = "pm.workload.health.open";

function formatRoleLabel(role: string) {
  if (!role) return "";
  if (role.toLowerCase() === "csm") return "CSM";
  if (role.toLowerCase() === "qa") return "QA";
  if (role.toLowerCase() === "pm") return "PM";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export default function Workload() {
  const users = useMockUsers().filter(u => u.role !== "submitter");
  const { user: me, roles } = useCurrentUser();
  const [healthOpen, setHealthOpen] = useState<boolean>(() => localStorage.getItem(HEALTH_OPEN_KEY) !== "0");
  useEffect(() => { localStorage.setItem(HEALTH_OPEN_KEY, healthOpen ? "1" : "0"); }, [healthOpen]);
  const tasksQuery = useTasksQuery();
  const projectsQuery = useProjectsQuery();
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("workload", "list");
  const { isMe } = useMeMode();
  const chips = useChipFilters("workload");
  const { types } = useTypeFilter("workload");
  const reloadAll = () => { void tasksQuery.refetch(); void projectsQuery.refetch(); };
  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const trackedTasks = useMemo(() => applyTaskTypes(tasks, types), [tasks, types]);
  const coMap = useTaskAssigneesMap();
  // Reverse: user_id -> Set<task_id>
  const taskIdsByUser = useMemo(() => {
    const m = new Map<string, Set<string>>();
    coMap.forEach((users, taskId) => {
      for (const uid of users) {
        if (!m.has(uid)) m.set(uid, new Set());
        m.get(uid)!.add(taskId);
      }
    });
    return m;
  }, [coMap]);

  const today = new Date(); const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  // ── Project health roll-up (lead roles only) ──────────────────────────────
  const teamsMap = useProjectTeamsMap();
  const canSeeHealth = roles.some(r => HEALTH_ROLES.includes(r));
  const healthProjectIds = useMemo(() => {
    // Empty set = all active projects (ProjectHealthList treats it as "no filter").
    if (!isMe || !me?.id) return new Set<string>();
    const s = new Set<string>();
    teamsMap.forEach((members, projectId) => { if (members.includes(me.id)) s.add(projectId); });
    return s;
  }, [isMe, me?.id, teamsMap]);
  const atRiskCount = useMemo(() => {
    const flagged = new Set<string>();
    for (const t of tasks) {
      if (t.status === "complete" || t.status === "approved") continue;
      if (healthProjectIds.size && !healthProjectIds.has(t.project_id)) continue;
      if (t.status === "blocked" || isHardOverdue(t)) flagged.add(t.project_id);
    }
    return flagged.size;
  }, [tasks, healthProjectIds]);

  return (
    <TooltipProvider>
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <CollectionToolbar
        title="Team Workload"
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        chipState={chips}
        typeFilterPage="workload"
      />
      {(tasksQuery.isPending || projectsQuery.isPending) ? (
        <WorkGridSkeleton />
      ) : (tasksQuery.isError || projectsQuery.isError) ? (
        <WorkLoadError retry={reloadAll} />
      ) : (
      <>
      {canSeeHealth && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setHealthOpen(o => !o)}
            className="flex items-center gap-2 text-sm font-semibold hover:text-foreground/80 transition"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", !healthOpen && "-rotate-90")} />
            Project health
            {atRiskCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{atRiskCount} at risk</Badge>
            )}
            <span className="text-xs font-normal text-muted-foreground">
              {isMe ? "My projects" : "All active projects"}
            </span>
          </button>
          {healthOpen && (
            <ProjectHealthList projects={projects} tasks={tasks} projectIds={healthProjectIds} />
          )}
        </section>
      )}
      {/* Single column on phones/tablets — person cards stay readable. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map(u => {
          const isMyRow = u.id === me?.id;
          const dimmed = isMe && !isMyRow;
          const myCoIds = taskIdsByUser.get(u.id);
          const activeRaw = trackedTasks.filter(t => (t.assignee_id === u.id || myCoIds?.has(t.id)) && t.status !== "complete" && t.status !== "approved");
          const active = applyTaskChips(activeRaw, chips.active, me?.id, undefined, taskIdsByUser.get(me?.id ?? ""));
          const thisWeek = active.filter(t => t.due_date && new Date(t.due_date) <= weekEnd);
          const cap = Math.round(u.capacity_hours_per_week / 8);
          const ratio = thisWeek.length / Math.max(1, cap);
          const tone = ratio < 0.7 ? "bg-emerald-500" : ratio < 1.05 ? "bg-amber-500" : "bg-red-500";
          return (
            <Card key={u.id} className={cn(
              "transition",
              isMyRow && isMe && "ring-2 ring-primary",
              dimmed && "opacity-50",
            )}>
              <CardContent className="p-4 space-y-3">
                <Link
                  to={`/pm/work?user=${u.id}`}
                  className="group flex items-center gap-3 rounded-md -m-1 p-1 hover:bg-muted/60 transition cursor-pointer"
                  title={`See all work assigned to ${u.name}`}
                >
                  <UserAvatar userId={u.id} size="md" />
                  <div>
                    <div className="font-semibold group-hover:underline">{u.name}{isMyRow && <span className="ml-1.5 text-[10px] uppercase text-primary no-underline">you</span>}</div>
                    <div className="text-xs text-muted-foreground">{formatRoleLabel(u.role)}</div>
                  </div>
                </Link>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>This week</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40">
                          {thisWeek.length} / {cap} tasks this week
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Current active tasks vs. recommended weekly capacity</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full", tone)} style={{ width: `${Math.min(100, ratio*100)}%` }} />
                  </div>
                </div>
                {/* Diagnosis chips — why this person is loaded. Each opens the exact list. */}
                {(() => {
                  const counts = WORK_STATE_FILTERS.map(f => ({ f, n: active.filter(t => matchesWorkState(t, f)).length }))
                    .filter(c => c.n > 0);
                  if (!counts.length) {
                    return <div className="text-[11px] text-muted-foreground">All on track</div>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {counts.map(({ f, n }) => (
                        <Link
                          key={f}
                          to={`/pm/work?user=${u.id}&filter=${f}`}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-full border transition hover:bg-muted",
                            f === "overdue" && "border-red-500/40 text-red-600 dark:text-red-400",
                            f === "blocked" && "border-amber-500/40 text-amber-600 dark:text-amber-400",
                            f !== "overdue" && f !== "blocked" && "border-border text-muted-foreground",
                          )}
                          title={`See ${u.name}'s ${WORK_STATE_LABEL[f].toLowerCase()} work`}
                        >
                          {WORK_STATE_LABEL[f]} {n}
                        </Link>
                      ))}
                    </div>
                  );
                })()}
                {mode === "list" ? (
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
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-72 overflow-auto">
                    {active.slice(0, 8).map(t => (
                      <div key={t.id} className="rounded-md border border-border p-2 hover:bg-muted/40 cursor-pointer space-y-1"
                        onClick={() => drawer.open(t.id)}>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px]">{t.type}</Badge>
                          <Badge variant="outline" className="text-[9px]">{t.priority}</Badge>
                        </div>
                        <div className="text-xs font-medium leading-tight">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{projById.get(t.project_id)?.title}</div>
                        <div className="flex items-center justify-between pt-1">
                          <StatusPill status={t.status} />
                          <span className="text-[10px] text-muted-foreground">{fmtDate(t.due_date)}</span>
                        </div>
                      </div>
                    ))}
                    {!active.length && <div className="text-xs italic text-muted-foreground">No active tasks</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <TaskDrawer />
      </>
      )}
    </div>
    </TooltipProvider>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  Inbox, Inbox as InboxIcon, LayoutGrid, Users, Calendar, FileText,
  LayoutTemplate,   Plug, Map as MapIcon, BarChart3, Code, BookOpen, Clock, Settings,
  Zap, Folder, ChevronRight, UserCircle, Building2, UsersRound, Headphones,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { teamForRole, teamForTask } from "@/lib/pm/track";
import { useMeMode } from "@/hooks/useMeMode";
import { canSee, type Surface } from "@/lib/pm/permissions";
import {
  useInternalProjectIds,
  useCareerSiteProjects,
  useClientNamesMap,
  clientNameForProject,
} from "@/lib/pm/clients";
import { useProjectTeamsMap } from "@/lib/pm/projectTeam";
import { projectColorHsl } from "@/lib/pm/projectColor";
import { fmtDateShort } from "@/lib/pm/format";
import { dueUrgency } from "@/components/pm/DueBadge";
import { cn } from "@/lib/utils";
import type { PmTask, PmProject } from "@/types/pm";
import { EMPTY_PROJECTS, EMPTY_TASKS, useProjectsQuery, useTasksQuery } from "@/lib/pm/queries";
import { SidebarWorkSkeleton } from "@/components/pm/WorkLoadingState";

type NavItem = { title: string; url: string; icon: LucideIcon; end?: boolean; key: Surface };

type SidebarQuickTask = {
  task: PmTask;
  clientName: string | null;
  dueDate: string | null;
  parentSiteName: string | null;
};

type SidebarProjectRow = {
  project: PmProject;
  openCount: number;
  clientName: string | null;
  dueDate: string | null;
};

const primaryNav: NavItem[] = [
  { title: "Daily Briefing", url: "/", icon: Inbox, end: true, key: "queue" },
  { title: "My Work", url: "/pm/my-work", icon: UserCircle, key: "myWork" },
  { title: "All Work", url: "/pm/work", icon: LayoutGrid, key: "work" },
  { title: "Triage Inbox", url: "/pm/inbox", icon: InboxIcon, key: "inbox" },
  { title: "Team Workload", url: "/pm/workload", icon: Users, key: "workload" },
  { title: "Global Timeline", url: "/pm/timeline", icon: Calendar, key: "timeline" },
  { title: "Time", url: "/pm/time", icon: Clock, key: "time" },
  { title: "Team Report", url: "/pm/report", icon: BarChart3, key: "report" },
  { title: "Clients", url: "/pm/clients", icon: Building2, key: "clients" },
  { title: "Live Career Sites", url: "/pm/live-sites", icon: Headphones, key: "clients" },
];

const configureNav: NavItem[] = [
  { title: "Forms", url: "/pm/forms", icon: FileText, key: "forms" },
  { title: "Templates", url: "/pm/templates", icon: LayoutTemplate, key: "templates" },
  { title: "Integrations", url: "/pm/integrations", icon: Plug, key: "integrations" },
  { title: "Team", url: "/pm/team", icon: UsersRound, key: "team" },
];

const snippetsItem: NavItem = { title: "Snippets", url: "/snippets", icon: Code, key: "snippets" };
const helpItem: NavItem = { title: "Help", url: "/pm/help", icon: BookOpen, key: "help" };
const settingsItem: NavItem = { title: "Settings", url: "/pm/settings", icon: Settings, key: "settings" };

const roadmapItems = [
  { title: "Roadmap Dashboard", url: "/roadmap/dashboard", icon: BarChart3 },
  { title: "Product Roadmap", url: "/roadmap", icon: MapIcon },
];

/** Compact due label for the narrow sidebar meta line. */
function sidebarDueMeta(dueDate: string | null | undefined): { label: string; className: string } | null {
  const u = dueUrgency(dueDate);
  if (u === "none" || !dueDate) return null;
  if (u === "overdue") {
    return {
      label: `Overdue · ${fmtDateShort(dueDate)}`,
      className: "text-destructive font-semibold",
    };
  }
  if (u === "today") {
    return {
      label: "Today",
      className: "text-amber-700 dark:text-amber-300 font-semibold",
    };
  }
  return {
    label: fmtDateShort(dueDate),
    className: "text-muted-foreground",
  };
}

function dueSortKey(dueDate: string | null | undefined): number {
  const u = dueUrgency(dueDate);
  if (u === "overdue") return 0;
  if (u === "today") return 1;
  if (u === "upcoming") return 2;
  return 3;
}

function compareByDueThenTitle(
  a: { dueDate: string | null; title: string; openCount?: number },
  b: { dueDate: string | null; title: string; openCount?: number },
): number {
  const urg = dueSortKey(a.dueDate) - dueSortKey(b.dueDate);
  if (urg !== 0) return urg;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  const aCount = a.openCount ?? 0;
  const bCount = b.openCount ?? 0;
  if (aCount !== bCount) return bCount - aCount;
  return a.title.localeCompare(b.title);
}

function rowTooltip(title: string, clientName: string | null, dueDate: string | null): string {
  const parts = [title];
  parts.push(clientName ?? "No client");
  if (dueDate) parts.push(`Due ${fmtDateShort(dueDate)}`);
  return parts.join(" — ");
}

function useMyWork() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const tasksQuery = useTasksQuery();
  const projectsQuery = useProjectsQuery();
  const teamsMap = useProjectTeamsMap();
  const clientNames = useClientNamesMap();
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  return useMemo(() => {
    if (!userId) return {
      myQuickTasks: [] as SidebarQuickTask[],
      myProjectsWithCounts: [] as SidebarProjectRow[],
      loading: tasksQuery.isPending || projectsQuery.isPending,
    };
    const active = (s: PmTask["status"]) => s !== "complete" && s !== "approved";
    const mine = tasks.filter(t => t.assignee_id === userId && active(t.status));

    const projMap = new Map(projects.map(p => [p.id, p]));
    const quickTasks = mine
      .filter(t => projMap.get(t.project_id)?.work_type === "request")
      .map((t): SidebarQuickTask => {
        const proj = projMap.get(t.project_id);
        const parent = proj?.parent_project_id ? projMap.get(proj.parent_project_id) : null;
        return {
          task: t,
          clientName: clientNameForProject(proj, clientNames),
          dueDate: t.due_date,
          parentSiteName: parent?.title ?? null,
        };
      })
      .sort((a, b) => compareByDueThenTitle(
        { dueDate: a.dueDate, title: a.task.title },
        { dueDate: b.dueDate, title: b.task.title },
      ));

    // Open assigned task counts on non-request projects.
    const projectCounts = new Map<string, number>();
    const earliestMyDue = new Map<string, string>();
    for (const t of mine) {
      const proj = projMap.get(t.project_id);
      if (!proj || proj.work_type === "request") continue;
      projectCounts.set(proj.id, (projectCounts.get(proj.id) ?? 0) + 1);
      if (t.due_date) {
        const prev = earliestMyDue.get(proj.id);
        if (!prev || t.due_date < prev) earliestMyDue.set(proj.id, t.due_date);
      }
    }

    // Union: assigned open tasks OR team member OR created/requested by me.
    const candidateIds = new Set<string>(projectCounts.keys());
    for (const [projectId, members] of teamsMap) {
      if (members.includes(userId)) candidateIds.add(projectId);
    }
    for (const p of projects) {
      if (p.created_by === userId || p.requested_by === userId) {
        candidateIds.add(p.id);
      }
    }

    const myProjectsWithCounts = [...candidateIds]
      .map((id): SidebarProjectRow | null => {
        const project = projMap.get(id);
        if (!project) return null;
        if (project.work_type === "request") return null;
        if (project.status === "complete" || project.status === "archived") return null;
        const openCount = projectCounts.get(id) ?? 0;
        const dueDate = project.go_live_date ?? earliestMyDue.get(id) ?? null;
        return {
          project,
          openCount,
          clientName: clientNameForProject(project, clientNames),
          dueDate,
        };
      })
      .filter((x): x is SidebarProjectRow => x != null)
      .sort((a, b) => compareByDueThenTitle(
        { dueDate: a.dueDate, title: a.project.title, openCount: a.openCount },
        { dueDate: b.dueDate, title: b.project.title, openCount: b.openCount },
      ));

    return {
      myQuickTasks: quickTasks,
      myProjectsWithCounts,
      loading: tasksQuery.isPending || projectsQuery.isPending,
    };
  }, [tasks, projects, userId, teamsMap, clientNames, tasksQuery.isPending, projectsQuery.isPending]);
}

function useUnclaimedCount() {
  const { roles } = useCurrentUser();
  const { isMe } = useMeMode();
  const { data: tasks = EMPTY_TASKS } = useTasksQuery();
  const isPM = roles.includes("pm");
  const myTeams = useMemo(() => new Set(roles.map(r => teamForRole(r))), [roles]);
  return useMemo(() => {
    return tasks.filter(t => {
      if (t.status !== "unclaimed") return false;
      if (!isMe || isPM) return true;
      return myTeams.has(teamForTask(t));
    }).length;
  }, [tasks, myTeams, isPM, isMe]);
}

/** Small colored dot used to identify a project at a glance. */
function ProjectDot({ projectId, isInternal, isCareerSite }: { projectId: string; isInternal?: boolean; isCareerSite?: boolean }) {
  const hsl = projectColorHsl(projectId, { isInternal, isCareerSite });
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0 mt-1.5"
      style={{ backgroundColor: `hsl(${hsl})` }}
      aria-hidden
    />
  );
}

function NavRow({ item, active, badge }: { item: NavItem; active: boolean; badge?: React.ReactNode }) {
  return (
    <NavLink
      to={item.url}
      end={item.end}
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors",
        active
          ? "bg-accent/60 text-accent-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "opacity-70")} />
      <span className="truncate flex-1">{item.title}</span>
      {badge}
    </NavLink>
  );
}

/** Compact count pill with consistent alignment. */
function CountBadge({ count, active }: { count: number; active?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded text-[10px] font-semibold tabular-nums leading-none",
      active
        ? "bg-background/80 text-foreground"
        : "bg-primary/10 text-primary",
    )}>
      {count}
    </span>
  );
}

/** Section label. "featured" is used for the user's own content (My Work). */
function SectionLabel({ children, featured }: { children: React.ReactNode; featured?: boolean }) {
  return (
    <SidebarGroupLabel className={cn(
      "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider",
      featured ? "text-foreground" : "text-muted-foreground/70",
    )}>
      <span className="inline-flex items-center gap-2">
        {featured && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
        {children}
      </span>
    </SidebarGroupLabel>
  );
}

function MetaLine({
  clientName,
  dueDate,
  parentSiteName,
}: {
  clientName: string | null;
  dueDate: string | null;
  parentSiteName?: string | null;
}) {
  const due = sidebarDueMeta(dueDate);
  return (
    <span className="block truncate text-[10px] text-muted-foreground">
      {clientName ?? "No client"}
      {parentSiteName && <> · Site: {parentSiteName}</>}
      {due && (
        <>
          {" · "}
          <span className={due.className}>{due.label}</span>
        </>
      )}
    </span>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const unclaimed = useUnclaimedCount();
  const { roles } = useCurrentUser();
  const { myQuickTasks, myProjectsWithCounts, loading: myWorkLoading } = useMyWork();
  const internalIds = useInternalProjectIds();
  const careerSiteIds = useCareerSiteProjects();

  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllQuick, setShowAllQuick] = useState(false);

  const submitterOnly = roles.length > 0 && roles.every(r => r === "submitter");
  const visiblePrimary = submitterOnly
    ? primaryNav.filter(i => i.key === "myWork")
    : primaryNav.filter(i => canSee(roles, i.key));
  const visibleConfigure = submitterOnly ? [] : configureNav.filter(i => canSee(roles, i.key));
  const canSeeSnippets = !submitterOnly && canSee(roles, "snippets");
  const canSeeHelp = canSee(roles, helpItem.key);
  const canSeeSettings = canSee(roles, settingsItem.key);
  const canSeeMyWork = !submitterOnly && canSee(roles, "work");
  const canSeeRoadmap = canSee(roles, "roadmap");

  const PROJ_LIMIT = 5;
  const QUICK_LIMIT = 5;
  const visibleProjects = showAllProjects ? myProjectsWithCounts : myProjectsWithCounts.slice(0, PROJ_LIMIT);
  const visibleQuick = showAllQuick ? myQuickTasks : myQuickTasks.slice(0, QUICK_LIMIT);

  return (
    <Sidebar className="w-60 border-r border-border bg-gradient-card">
      <SidebarContent className="py-1">
        <div className="p-4 border-b border-border/50">
          <h1 className="font-unbounded font-bold text-primary text-lg">HireClix</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Project Management</p>
        </div>

        {/* NAVIGATE — small, iconic, quiet */}
        <SidebarGroup>
          <SectionLabel>Navigate</SectionLabel>
          <SidebarGroupContent>
            <nav className="space-y-0.5 px-2">
              {visiblePrimary.map(item => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                const isSubmitterOnly = roles.length === 1 && roles[0] === "submitter";
                const showBadge = (item.key === "queue" || item.key === "inbox") && unclaimed > 0 && !isSubmitterOnly;
                return (
                  <NavRow
                    key={item.title}
                    item={item}
                    active={active}
                    badge={showBadge ? (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold unclaimed-pulse">
                        {unclaimed}
                      </span>
                    ) : undefined}
                  />
                );
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-3 w-auto bg-border/50" />

        {/* MY WORK — loud, content-forward */}
        {canSeeMyWork && (
          <SidebarGroup>
            <div className="rounded-lg border border-border/40 bg-card/50 p-2">
              <SectionLabel featured>Assigned to me</SectionLabel>
              <SidebarGroupContent>
                {myWorkLoading ? (
                  <SidebarWorkSkeleton />
                ) : (
                <div className="space-y-3">
                  {/* Quick Tasks */}
                  <div>
                    <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold text-foreground/80">
                      <Zap className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">Quick Tasks</span>
                      {myQuickTasks.length > 0 && (
                        <CountBadge count={myQuickTasks.length} />
                      )}
                    </div>
                    {myQuickTasks.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground/60 px-2 py-1 italic">None</div>
                    ) : (
                      <div className="space-y-px">
                        {visibleQuick.map(({ task: t, clientName, dueDate, parentSiteName }) => (
                          <NavLink
                            key={t.id}
                            to={`/pm/tasks/${t.id}`}
                            className={({ isActive }) => cn(
                              "flex items-start gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-accent/30 group",
                              isActive ? "bg-accent/50 text-foreground font-medium" : "text-foreground/80",
                            )}
                            title={rowTooltip(t.title, clientName, dueDate)}
                          >
                            <ProjectDot
                              projectId={t.project_id}
                              isInternal={internalIds.has(t.project_id)}
                              isCareerSite={careerSiteIds.has(t.project_id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-medium">{t.title}</span>
                              <MetaLine clientName={clientName} dueDate={dueDate} parentSiteName={parentSiteName} />
                            </span>
                          </NavLink>
                        ))}
                        {myQuickTasks.length > QUICK_LIMIT && (
                          <button
                            type="button"
                            onClick={() => setShowAllQuick(v => !v)}
                            className="w-full text-left px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            {showAllQuick ? "Show less" : `+ ${myQuickTasks.length - QUICK_LIMIT} more`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Projects */}
                  <div>
                    <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold text-foreground/80">
                      <Folder className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">Active Projects</span>
                      {myProjectsWithCounts.length > 0 && (
                        <CountBadge count={myProjectsWithCounts.length} />
                      )}
                    </div>
                    {myProjectsWithCounts.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground/60 px-2 py-1 italic">None</div>
                    ) : (
                      <div className="space-y-px">
                        {visibleProjects.map(({ project, openCount, clientName, dueDate }) => {
                          const isActive = pathname.startsWith(`/pm/projects/${project.id}`);
                          const hsl = projectColorHsl(project.id, {
                            isInternal: internalIds.has(project.id),
                            isCareerSite: careerSiteIds.has(project.id),
                          });
                          return (
                            <NavLink
                              key={project.id}
                              to={`/pm/projects/${project.id}`}
                              className={cn(
                                "relative flex items-start gap-2 pl-3 pr-2 py-1.5 rounded text-[12px] hover:bg-accent/30",
                                isActive ? "bg-accent/50 text-foreground font-semibold" : "text-foreground/80",
                              )}
                              title={rowTooltip(project.title, clientName, dueDate)}
                            >
                              <span
                                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                                style={{ backgroundColor: `hsl(${hsl})` }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-medium">{project.title}</span>
                                <MetaLine clientName={clientName} dueDate={dueDate} />
                              </span>
                              {openCount > 0 && (
                                <CountBadge count={openCount} active={isActive} />
                              )}
                            </NavLink>
                          );
                        })}
                        {myProjectsWithCounts.length > PROJ_LIMIT && (
                          <button
                            type="button"
                            onClick={() => setShowAllProjects(v => !v)}
                            className="w-full text-left px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          >
                            <ChevronRight className={cn("h-3 w-3 transition-transform", showAllProjects && "rotate-90")} />
                            {showAllProjects ? "Show less" : `${myProjectsWithCounts.length - PROJ_LIMIT} more`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </SidebarGroupContent>
            </div>
          </SidebarGroup>
        )}

        <Separator className="mx-3 w-auto bg-border/50" />

        {/* CONFIGURE — quiet, only visible to roles who can see it */}
        {visibleConfigure.length > 0 && (
          <SidebarGroup>
            <SectionLabel>Configure</SectionLabel>
            <SidebarGroupContent>
              <nav className="space-y-0.5 px-2">
                {visibleConfigure.map(item => {
                  const active = pathname.startsWith(item.url);
                  return <NavRow key={item.title} item={item} active={active} />;
                })}
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleConfigure.length > 0 && (canSeeSnippets || canSeeHelp || canSeeSettings) && (
          <Separator className="mx-3 w-auto bg-border/50" />
        )}

        {/* RESOURCES */}
        {(canSeeSnippets || canSeeHelp || canSeeSettings) && (
          <SidebarGroup>
            <SectionLabel>Resources</SectionLabel>
            <SidebarGroupContent>
              <nav className="space-y-0.5 px-2">
                {canSeeSnippets && (
                  <NavRow item={snippetsItem} active={pathname.startsWith(snippetsItem.url)} />
                )}
                {canSeeHelp && (
                  <NavRow item={helpItem} active={pathname.startsWith(helpItem.url)} />
                )}
                {canSeeSettings && (
                  <NavRow item={settingsItem} active={pathname.startsWith(settingsItem.url)} />
                )}
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {canSeeRoadmap && (
          <>
        <Separator className="mx-3 w-auto bg-border/50" />

        <SidebarGroup>
          <SectionLabel>Roadmap (Legacy)</SectionLabel>
          <SidebarGroupContent>
            <nav className="space-y-0.5 px-2">
              {roadmapItems.map(item => {
                const active = pathname.startsWith(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px]",
                      active
                        ? "bg-accent/60 text-accent-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "opacity-70")} />
                    <span className="truncate">{item.title}</span>
                  </NavLink>
                );
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

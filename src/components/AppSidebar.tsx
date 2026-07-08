import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Inbox, LayoutGrid, Users, Calendar, FileText,
  LayoutTemplate, Plug, Map as MapIcon, BarChart3, Code, BookOpen, Clock,
  Zap, Folder, ChevronRight,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { teamForRole, teamForTask } from "@/lib/pm/track";
import { useMeMode } from "@/hooks/useMeMode";
import { canSee, type Surface } from "@/lib/pm/permissions";
import { useInternalProjectIds, useCareerSiteProjects } from "@/lib/pm/clients";
import { projectColorHsl } from "@/lib/pm/projectColor";
import { cn } from "@/lib/utils";
import type { PmTask, PmProject } from "@/types/pm";

type NavItem = { title: string; url: string; icon: any; end?: boolean; key: Surface };

const primaryNav: NavItem[] = [
  { title: "Work Queue", url: "/pm", icon: Inbox, end: true, key: "queue" },
  { title: "Work", url: "/pm/work", icon: LayoutGrid, key: "work" },
  { title: "Team Workload", url: "/pm/workload", icon: Users, key: "workload" },
  { title: "Global Timeline", url: "/pm/timeline", icon: Calendar, key: "timeline" },
  { title: "Time", url: "/pm/time", icon: Clock, key: "time" },
];

const configureNav: NavItem[] = [
  { title: "Forms", url: "/pm/forms", icon: FileText, key: "forms" },
  { title: "Templates", url: "/pm/templates", icon: LayoutTemplate, key: "templates" },
  { title: "Integrations", url: "/pm/integrations", icon: Plug, key: "integrations" },
];

const snippetsItem: NavItem = { title: "Snippets", url: "/snippets", icon: Code, key: "snippets" };
const helpItem: NavItem = { title: "Help", url: "/pm/help", icon: BookOpen, key: "help" };

const roadmapItems = [
  { title: "Roadmap Dashboard", url: "/roadmap/dashboard", icon: BarChart3 },
  { title: "Product Roadmap", url: "/roadmap", icon: MapIcon },
];

function useMyWork() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const reload = async () => {
    const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
    setTasks(t); setProjects(p);
  };
  useEffect(() => { reload(); }, []);
  useTasksChanged(reload);
  return useMemo(() => {
    if (!userId) return { myQuickTasks: [] as PmTask[], myProjectsWithCounts: [] as Array<{ project: PmProject; openCount: number }> };
    const active = (s: PmTask["status"]) => s !== "complete" && s !== "approved";
    const mine = tasks.filter(t => t.assignee_id === userId && active(t.status));

    // Split by work_type of parent project — quick tasks (request-type projects) vs project tasks.
    const projMap = new Map(projects.map(p => [p.id, p]));
    const quickTasks = mine.filter(t => (projMap.get(t.project_id) as any)?.work_type === "request");

    // My projects = distinct project ids from my open (non-request) tasks, with counts of my open tasks.
    const projectCounts = new Map<string, number>();
    for (const t of mine) {
      const proj = projMap.get(t.project_id);
      if (!proj) continue;
      if ((proj as any).work_type === "request") continue;
      projectCounts.set(proj.id, (projectCounts.get(proj.id) ?? 0) + 1);
    }
    const myProjectsWithCounts = [...projectCounts.entries()]
      .map(([id, openCount]) => ({ project: projMap.get(id)!, openCount }))
      .filter(x => x.project)
      .sort((a, b) => b.openCount - a.openCount);

    return {
      myQuickTasks: quickTasks.slice(0, 8),
      myProjectsWithCounts,
    };
  }, [tasks, projects, userId]);
}

function useUnclaimedCount() {
  const { role } = useCurrentUser();
  const { isMe } = useMeMode();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const reload = async () => setTasks(await fetchTasks());
  useEffect(() => { reload(); }, []);
  useTasksChanged(reload);
  return useMemo(() => {
    const myTeam = teamForRole(role);
    return tasks.filter(t => {
      if (t.status !== "unclaimed") return false;
      if (!isMe || role === "pm") return true;
      return teamForTask(t) === myTeam;
    }).length;
  }, [tasks, role, isMe]);
}

/** Small colored dot used to identify a project at a glance. */
function ProjectDot({ projectId, isInternal, isCareerSite }: { projectId: string; isInternal?: boolean; isCareerSite?: boolean }) {
  const hsl = projectColorHsl(projectId, { isInternal, isCareerSite });
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
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

export function AppSidebar() {
  const { pathname } = useLocation();
  const unclaimed = useUnclaimedCount();
  const { role } = useCurrentUser();
  const { myQuickTasks, myProjectsWithCounts } = useMyWork();
  const internalIds = useInternalProjectIds();
  const careerSiteIds = useCareerSiteProjects();

  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllQuick, setShowAllQuick] = useState(false);

  const visiblePrimary = primaryNav.filter(i => canSee(role, i.key));
  const visibleConfigure = configureNav.filter(i => canSee(role, i.key));
  const canSeeSnippets = canSee(role, "snippets");
  const canSeeHelp = canSee(role, helpItem.key);
  const canSeeMyWork = canSee(role, "work");

  const PROJ_LIMIT = 6;
  const QUICK_LIMIT = 5;
  const visibleProjects = showAllProjects ? myProjectsWithCounts : myProjectsWithCounts.slice(0, PROJ_LIMIT);
  const visibleQuick = showAllQuick ? myQuickTasks : myQuickTasks.slice(0, QUICK_LIMIT);

  return (
    <Sidebar className="w-60 border-r border-border bg-gradient-card">
      <SidebarContent>
        <div className="p-4 border-b border-border/50">
          <h1 className="font-unbounded font-bold text-primary text-lg">HireClix</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Project Management</p>
        </div>

        {/* NAVIGATE — small, iconic, quiet */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 pt-3 pb-1">
            Navigate
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-0.5 px-2">
              {visiblePrimary.map(item => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                const showBadge = item.key === "queue" && unclaimed > 0;
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

        {/* MY WORK — loud, content-forward */}
        {canSeeMyWork && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 px-3 pt-3 pb-1">
              My Work
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 space-y-3">
                {/* Quick Tasks */}
                <div>
                  <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    Quick Tasks
                    {myQuickTasks.length > 0 && (
                      <span className="ml-auto text-[10px] font-normal">{myQuickTasks.length}</span>
                    )}
                  </div>
                  {myQuickTasks.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 px-2 py-1 italic">None</div>
                  ) : (
                    <div className="space-y-px">
                      {visibleQuick.map(t => (
                        <NavLink
                          key={t.id}
                          to={`/pm/tasks/${t.id}`}
                          className={({ isActive }) => cn(
                            "flex items-center gap-2 px-2 py-1 rounded text-[12px] hover:bg-accent/30 group",
                            isActive ? "bg-accent/50 text-foreground font-medium" : "text-foreground/80",
                          )}
                          title={t.title}
                        >
                          <ProjectDot
                            projectId={t.project_id}
                            isInternal={internalIds.has(t.project_id)}
                            isCareerSite={careerSiteIds.has(t.project_id)}
                          />
                          <span className="truncate flex-1">{t.title}</span>
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
                  <div className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold text-muted-foreground">
                    <Folder className="h-3 w-3" />
                    Active Projects
                    {myProjectsWithCounts.length > 0 && (
                      <span className="ml-auto text-[10px] font-normal">{myProjectsWithCounts.length}</span>
                    )}
                  </div>
                  {myProjectsWithCounts.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 px-2 py-1 italic">None</div>
                  ) : (
                    <div className="space-y-px">
                      {visibleProjects.map(({ project, openCount }) => {
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
                              "relative flex items-center gap-2 pl-3 pr-2 py-1 rounded text-[12px] hover:bg-accent/30",
                              isActive ? "bg-accent/50 text-foreground font-semibold" : "text-foreground/80",
                            )}
                            title={project.title}
                          >
                            <span
                              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                              style={{ backgroundColor: `hsl(${hsl})` }}
                              aria-hidden
                            />
                            <span className="truncate flex-1">{project.title}</span>
                            <span className={cn(
                              "text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded",
                              isActive ? "bg-background/60 text-foreground" : "bg-muted text-muted-foreground",
                            )}>
                              {openCount}
                            </span>
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
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* CONFIGURE — quiet, only visible to roles who can see it */}
        {visibleConfigure.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 pt-3 pb-1">
              Configure
            </SidebarGroupLabel>
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

        {/* RESOURCES */}
        {(canSeeSnippets || canSeeHelp) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 pt-3 pb-1">
              Resources
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <nav className="space-y-0.5 px-2">
                {canSeeSnippets && (
                  <NavRow item={snippetsItem} active={pathname.startsWith(snippetsItem.url)} />
                )}
                {canSeeHelp && (
                  <NavRow item={helpItem} active={pathname.startsWith(helpItem.url)} />
                )}
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 pt-3 pb-1">
            Roadmap (Legacy)
          </SidebarGroupLabel>
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
      </SidebarContent>
    </Sidebar>
  );
}

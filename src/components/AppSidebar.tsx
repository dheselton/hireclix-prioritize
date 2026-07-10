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
import { Separator } from "@/components/ui/separator";
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
  { title: "Daily Briefing", url: "/pm", icon: Inbox, end: true, key: "queue" },
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

export function AppSidebar() {
  const { pathname } = useLocation();
  const unclaimed = useUnclaimedCount();
  const { roles } = useCurrentUser();
  const { myQuickTasks, myProjectsWithCounts } = useMyWork();
  const internalIds = useInternalProjectIds();
  const careerSiteIds = useCareerSiteProjects();

  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllQuick, setShowAllQuick] = useState(false);

  const visiblePrimary = primaryNav.filter(i => canSee(roles, i.key));
  const visibleConfigure = configureNav.filter(i => canSee(roles, i.key));
  const canSeeSnippets = canSee(roles, "snippets");
  const canSeeHelp = canSee(roles, helpItem.key);
  const canSeeMyWork = canSee(roles, "work");

  const PROJ_LIMIT = 6;
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
                const showBadge = item.key === "queue" && unclaimed > 0 && !isSubmitterOnly;
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
              <SectionLabel featured>My Work</SectionLabel>
              <SidebarGroupContent>
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
                              <CountBadge count={openCount} active={isActive} />
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

        {visibleConfigure.length > 0 && (canSeeSnippets || canSeeHelp) && (
          <Separator className="mx-3 w-auto bg-border/50" />
        )}

        {/* RESOURCES */}
        {(canSeeSnippets || canSeeHelp) && (
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
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <Separator className="mx-3 w-auto bg-border/50" />

        {/* ROADMAP (LEGACY) */}
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
      </SidebarContent>
    </Sidebar>
  );
}

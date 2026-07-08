import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Inbox, LayoutGrid, Users, Calendar, FileText,
  LayoutTemplate, Plug, Map, BarChart3, Code, BookOpen, Clock,
  Plus, Minus, CheckSquare, Folder,
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
import type { PmTask, PmProject } from "@/types/pm";

type NavItem = { title: string; url: string; icon: any; end?: boolean; key: Surface };

const pmItems: NavItem[] = [
  { title: "Work Queue", url: "/pm", icon: Inbox, end: true, key: "queue" },
  { title: "Work", url: "/pm/work", icon: LayoutGrid, key: "work" },
  { title: "Team Workload", url: "/pm/workload", icon: Users, key: "workload" },
  { title: "Global Timeline", url: "/pm/timeline", icon: Calendar, key: "timeline" },
  { title: "Time", url: "/pm/time", icon: Clock, key: "time" },
  { title: "Forms", url: "/pm/forms", icon: FileText, key: "forms" },
  { title: "Templates", url: "/pm/templates", icon: LayoutTemplate, key: "templates" },
  { title: "Integrations", url: "/pm/integrations", icon: Plug, key: "integrations" },
];

const roadmapItems = [
  { title: "Roadmap Dashboard", url: "/roadmap/dashboard", icon: BarChart3 },
  { title: "Product Roadmap", url: "/roadmap", icon: Map },
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
    if (!userId) return { myTasks: [] as PmTask[], myProjects: [] as PmProject[] };
    const active = (s: PmTask["status"]) => s !== "complete" && s !== "approved";
    const myTasks = tasks.filter(t => t.assignee_id === userId && active(t.status)).slice(0, 8);
    const projectIds = new Set<string>();
    tasks.forEach(t => { if (t.assignee_id === userId && active(t.status) && t.project_id) projectIds.add(t.project_id); });
    const myProjects = projects.filter(p => projectIds.has(p.id)).slice(0, 8);
    return { myTasks, myProjects };
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

const snippetsItem: NavItem = { title: "Snippets", url: "/snippets", icon: Code, key: "snippets" };
const helpItem: NavItem = { title: "Help", url: "/pm/help", icon: BookOpen, key: "help" };

export function AppSidebar() {
  const { pathname } = useLocation();
  const unclaimed = useUnclaimedCount();
  const { role } = useCurrentUser();
  const { myTasks, myProjects } = useMyWork();
  const [workExpanded, setWorkExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem("pm.sidebar.workExpanded") === "1"; } catch { return false; }
  });
  const toggleWork = () => setWorkExpanded(v => {
    const next = !v;
    try { localStorage.setItem("pm.sidebar.workExpanded", next ? "1" : "0"); } catch {}
    return next;
  });
  const visiblePm = pmItems.filter(i => canSee(role, i.key));
  const withSnippets = canSee(role, "snippets") ? [...visiblePm, snippetsItem] : visiblePm;
  const items = [...withSnippets, helpItem];
  return (
    <Sidebar className="w-60 border-r border-border bg-gradient-card">
      <SidebarContent>
        <div className="p-4 border-b border-border/50">
          <h1 className="font-unbounded font-bold text-primary text-lg">HireClix</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Project Management</p>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-2">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-1 px-2">
              {items.map((item) => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                const showBadge = item.key === "queue" && unclaimed > 0;
                const isWork = item.key === "work";
                return (
                  <div key={item.title}>
                    <div className={`nav-item flex items-center justify-between gap-1 pr-1 ${active ? "bg-accent/40 text-accent-foreground font-medium" : ""}`}>
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                      {showBadge && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold unclaimed-pulse">
                          {unclaimed}
                        </span>
                      )}
                      {isWork && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWork(); }}
                          className="p-1 rounded hover:bg-accent/60 text-muted-foreground"
                          aria-label={workExpanded ? "Collapse my work" : "Expand my work"}
                          aria-expanded={workExpanded}
                        >
                          {workExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                    {isWork && workExpanded && (
                      <div className="ml-6 mt-1 mb-1 space-y-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" /> My Tasks
                          </div>
                          {myTasks.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground px-2 py-1">None assigned</div>
                          ) : (
                            myTasks.map(t => (
                              <NavLink
                                key={t.id}
                                to={`/pm/tasks/${t.id}`}
                                className="block text-xs px-2 py-1 rounded hover:bg-accent/40 truncate text-foreground/80"
                                title={t.title}
                              >
                                {t.title}
                              </NavLink>
                            ))
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 flex items-center gap-1">
                            <Folder className="h-3 w-3" /> My Projects
                          </div>
                          {myProjects.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground px-2 py-1">None</div>
                          ) : (
                            myProjects.map(p => (
                              <NavLink
                                key={p.id}
                                to={`/pm/projects/${p.id}`}
                                className="block text-xs px-2 py-1 rounded hover:bg-accent/40 truncate text-foreground/80"
                                title={p.title}
                              >
                                {p.title}
                              </NavLink>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-2">
            Roadmap (Legacy)
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-1 px-2">
              {roadmapItems.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    className={`nav-item ${active ? "bg-accent/40 text-accent-foreground font-medium" : ""}`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.title}</span>
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

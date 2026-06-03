import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Inbox, LayoutGrid, Users, Calendar, FileText,
  LayoutTemplate, Plug, Map, BarChart3, Code, BookOpen, Clock,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { fetchTasks } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { teamForRole, teamForTask } from "@/lib/pm/track";
import { useMeMode } from "@/hooks/useMeMode";
import { canSee, type Surface } from "@/lib/pm/permissions";
import type { PmTask } from "@/types/pm";

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
  const baseItems = role === "submitter"
    ? pmItems.filter(i => SUBMITTER_ITEM_KEYS.has(i.key))
    : pmItems;
  const withSnippets = role === "developer" || role === "designer"
    ? [...baseItems, snippetsItem as any]
    : baseItems;
  const items = [...withSnippets, helpItem as any];
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
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    end={item.end}
                    className={`nav-item flex items-center justify-between ${active ? "bg-accent/40 text-accent-foreground font-medium" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.title}</span>
                    </span>
                    {showBadge && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold unclaimed-pulse">
                        {unclaimed}
                      </span>
                    )}
                  </NavLink>
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

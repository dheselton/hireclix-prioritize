import { NavLink, useLocation } from "react-router-dom";
import {
  Inbox, LayoutGrid, FolderKanban, Users, Calendar, FileText,
  LayoutTemplate, Plug, Map, BarChart3,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
} from "@/components/ui/sidebar";

const pmItems = [
  { title: "Work Queue", url: "/pm", icon: Inbox, end: true },
  { title: "Board", url: "/pm/board", icon: LayoutGrid },
  { title: "Projects", url: "/pm/projects", icon: FolderKanban },
  { title: "Team Workload", url: "/pm/workload", icon: Users },
  { title: "Global Timeline", url: "/pm/timeline", icon: Calendar },
  { title: "Forms", url: "/pm/forms", icon: FileText },
  { title: "Templates", url: "/pm/templates", icon: LayoutTemplate },
  { title: "Integrations", url: "/pm/integrations", icon: Plug },
];

const roadmapItems = [
  { title: "Roadmap Dashboard", url: "/roadmap/dashboard", icon: BarChart3 },
  { title: "Product Roadmap", url: "/roadmap", icon: Map },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  return (
    <Sidebar className="w-60 border-r border-border bg-gradient-card">
      <SidebarContent>
        <div className="p-4 border-b border-border/50">
          <h1 className="font-unbounded font-bold text-primary text-lg">Agency PM</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Project Management</p>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-2">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-1 px-2">
              {pmItems.map((item) => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    end={item.end}
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

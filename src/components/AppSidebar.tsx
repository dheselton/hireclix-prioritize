import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  Video,
  Plug,
  Palette,
  HelpCircle,
  Settings,
  Activity,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Internal Docs", url: "/internal-docs", icon: FileText },
  { title: "Client-Facing Docs", url: "/client-docs", icon: FolderOpen },
  { title: "Loom Library", url: "/loom-library", icon: Video },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Job API Monitor", url: "/job-api-monitor", icon: Activity },
  { title: "Design System", url: "/design-system", icon: Palette },
  { title: "FAQ", url: "/faq", icon: HelpCircle },
  { title: "Admin", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar className="w-60 border-r border-border bg-gradient-card">
      <SidebarContent>
        <div className="p-4 border-b border-border/50">
          <h1 className="font-unbounded font-bold text-primary text-lg">
            HireClix
          </h1>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-1 px-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end={item.url === "/"}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "[data-active='true']" : ""}`
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

import { NavLink } from "react-router-dom";
import {
  Map,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Product Roadmap", url: "/", icon: Map },
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

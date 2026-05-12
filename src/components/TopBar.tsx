import { useEffect } from "react";
import { Search, Bell, List, LayoutGrid, Columns, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { MeModeToggle } from "@/components/pm/MeModeToggle";
import { installMeModeHotkey } from "@/hooks/useMeMode";
import { useDefaultViewMode, type ViewMode } from "@/hooks/useViewMode";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  pm: "PM", designer: "Designer", developer: "Developer", submitter: "Submitter",
};

const ROLE_BADGE_LABEL: Record<string, string> = {
  pm: "Project Manager", designer: "Designer", developer: "Developer", submitter: "Submitter",
};

const ROLE_BADGE_STYLE: Record<string, string> = {
  pm: "bg-[hsl(var(--role-pm))] text-[hsl(var(--role-pm-foreground))]",
  designer: "bg-[hsl(var(--role-designer))] text-[hsl(var(--role-designer-foreground))]",
  developer: "bg-[hsl(var(--role-developer))] text-[hsl(var(--role-developer-foreground))]",
  submitter: "bg-[hsl(var(--role-submitter))] text-[hsl(var(--role-submitter-foreground))]",
};

export function TopBar() {
  const { user, users, setCurrent } = useCurrentUser();
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  useEffect(() => { installMeModeHotkey(); }, []);

  return (
    <header className="h-16 border-b border-border bg-card flex items-center px-4 gap-4 sticky top-0 z-40">
      <SidebarTrigger className="flex-shrink-0" />
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search projects, tasks, clients..." className="pl-10 bg-background" />
        </div>
      </div>

      {user?.role && (
        <span
          className={`hidden md:inline-flex items-center px-2.5 h-6 rounded-full text-[11px] font-semibold ${ROLE_BADGE_STYLE[user.role] ?? ""}`}
          aria-label={`Your role: ${ROLE_BADGE_LABEL[user.role]}`}
          title={`Your role: ${ROLE_BADGE_LABEL[user.role]}`}
        >
          {ROLE_BADGE_LABEL[user.role]}
        </span>
      )}
      <Badge variant="outline" className="hidden lg:inline-flex">Auth disabled · dev mode</Badge>

      <DefaultViewMenu />
      <MeModeToggle />

      <Select value={user?.id ?? ""} onValueChange={setCurrent}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover max-h-[400px]">
          {(['pm','designer','developer','submitter'] as const).map(r => {
            const group = users.filter(u => u.role === r);
            if (!group.length) return null;
            return (
              <div key={r}>
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {ROLE_LABEL[r]}s
                </div>
                {group.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full text-[8px] text-white font-bold flex items-center justify-center"
                        style={{ backgroundColor: u.avatar_color ?? "hsl(var(--primary))" }}
                      >
                        {u.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </span>
                      {u.name}{u.secondary_role ? ` · +${ROLE_LABEL[u.secondary_role]}` : ""}
                    </span>
                  </SelectItem>
                ))}
              </div>
            );
          })}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="h-5 w-5" />
      </Button>

      <Avatar className="h-9 w-9">
        <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name} />
        <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
      </Avatar>
    </header>
  );
}

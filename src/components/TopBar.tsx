import { useEffect } from "react";
import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { MeModeToggle } from "@/components/pm/MeModeToggle";
import { installMeModeHotkey } from "@/hooks/useMeMode";

const ROLE_LABEL: Record<string, string> = {
  pm: "PM", designer: "Designer", developer: "Developer", submitter: "Submitter",
};

export function TopBar() {
  const { user, users, setCurrent } = useCurrentUser();
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";

  return (
    <header className="h-16 border-b border-border bg-card flex items-center px-4 gap-4 sticky top-0 z-40">
      <SidebarTrigger className="flex-shrink-0" />
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search projects, tasks, clients..." className="pl-10 bg-background" />
        </div>
      </div>

      <Badge variant="outline" className="hidden md:inline-flex">Auth disabled · dev mode</Badge>

      <Select value={user?.id ?? ""} onValueChange={setCurrent}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {users.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.name} · {ROLE_LABEL[u.role]}
            </SelectItem>
          ))}
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

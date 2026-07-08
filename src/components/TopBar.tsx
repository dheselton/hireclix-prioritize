import { useEffect, useState } from "react";
import { List, LayoutGrid, Columns, Eye, MoreVertical, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser, isAuthEnabled } from "@/lib/pm/mockUser";
import { MeModeToggle } from "@/components/pm/MeModeToggle";
import { installMeModeHotkey } from "@/hooks/useMeMode";
import { useDefaultViewMode, type ViewMode } from "@/hooks/useViewMode";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  useEffect(() => { installMeModeHotkey(); }, []);

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card flex items-center px-3 md:px-4 gap-2 md:gap-4 sticky top-0 z-40 safe-top">
      <SidebarTrigger className="flex-shrink-0 h-10 w-10 md:h-9 md:w-9" />

      {/* Desktop search always visible; mobile toggles it into full-row overlay */}
      {!isMobile && (
        <div className="flex-1 max-w-xl">
          <GlobalSearch />
        </div>
      )}

      {isMobile && !searchOpen && (
        <div className="flex-1" />
      )}
      {isMobile && searchOpen && (
        <div className="flex-1 min-w-0">
          <GlobalSearch />
        </div>
      )}

      {!isMobile && user?.role && (
        <span
          className={`inline-flex items-center px-2.5 h-6 rounded-full text-[11px] font-semibold ${ROLE_BADGE_STYLE[user.role] ?? ""}`}
          aria-label={`Your role: ${ROLE_BADGE_LABEL[user.role]}`}
          title={`Your role: ${ROLE_BADGE_LABEL[user.role]}`}
        >
          {ROLE_BADGE_LABEL[user.role]}
        </span>
      )}
      {!isMobile && !isAuthEnabled() && (
        <Badge variant="outline" className="hidden lg:inline-flex">Auth disabled · dev mode</Badge>
      )}

      {!isMobile && (
        <>
          <DefaultViewMenu />
          <MeModeToggle />
          {!isAuthEnabled() && (
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
          )}
        </>
      )}

      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setSearchOpen(s => !s)}
          aria-label={searchOpen ? "Close search" : "Open search"}
        >
          <SearchIcon className="h-5 w-5" />
        </Button>
      )}

      <NotificationsBell />

      {isMobile ? (
        <MobileOverflowMenu
          currentUserId={user?.id ?? ""}
          users={users}
          setCurrent={setCurrent}
        />
      ) : (
        <Avatar className="h-9 w-9">
          <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
        </Avatar>
      )}
    </header>
  );
}

function MobileOverflowMenu({
  currentUserId, users, setCurrent,
}: { currentUserId: string; users: ReturnType<typeof useCurrentUser>["users"]; setCurrent: (id: string) => void }) {
  const { user } = useCurrentUser();
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account and options"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card border border-border flex items-center justify-center">
            <MoreVertical className="h-2.5 w-2.5" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 z-50 bg-popover p-3 space-y-3">
        {user && (
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">{ROLE_BADGE_LABEL[user.role] ?? user.role}</div>
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">View mode</div>
          <MeModeToggle />
        </div>
        {!isAuthEnabled() && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Switch user (dev)</div>
            <Select value={currentUserId} onValueChange={setCurrent}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover max-h-[300px]">
                {(['pm','designer','developer','submitter'] as const).map(r => {
                  const group = users.filter(u => u.role === r);
                  if (!group.length) return null;
                  return (
                    <div key={r}>
                      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ROLE_LABEL[r]}s
                      </div>
                      {group.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "list", label: "List", icon: <List className="h-4 w-4" /> },
  { value: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> },
  { value: "kanban", label: "Kanban", icon: <Columns className="h-4 w-4" /> },
];

function DefaultViewMenu() {
  const { defaultMode, setDefault, resetAll } = useDefaultViewMode();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="hidden md:inline-flex h-8" title="Default view preference">
          <Eye className="h-4 w-4 mr-1" /> Default view
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 z-50 bg-popover" align="end">
        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
          Default view
        </div>
        <div className="space-y-1">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDefault(opt.value)}
              className={`w-full flex items-center gap-2 px-2 h-8 rounded text-sm transition ${
                defaultMode === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
        <Button
          size="sm" variant="ghost" className="w-full mt-2 h-7 text-xs"
          onClick={() => { resetAll(); toast.success("Reset all view preferences"); }}
        >
          Reset all view preferences
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          Used as the starting view on every screen until you pick a different view there.
        </p>
      </PopoverContent>
    </Popover>
  );
}

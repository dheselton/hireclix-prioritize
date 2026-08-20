import { useEffect, useState } from "react";
import { List, LayoutGrid, Columns, Eye, MoreVertical, Search as SearchIcon, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { useAuth } from "@/hooks/useAuth";
import { MeModeToggle } from "@/components/pm/MeModeToggle";
import { installMeModeHotkey } from "@/hooks/useMeMode";
import { useDefaultViewMode, type ViewMode } from "@/hooks/useViewMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const ROLE_BADGE_LABEL: Record<string, string> = {
  pm: "Project Manager", designer: "Designer", developer: "Developer", submitter: "Submitter",
  ba: "Business Analyst", tech_lead: "Technical Resource",
  qa: "QA", strategist: "Strategist", analyst: "Analyst", csm: "CSM", support: "Support",
};

const ROLE_BADGE_STYLE: Record<string, string> = {
  pm: "bg-[hsl(var(--role-pm))] text-[hsl(var(--role-pm-foreground))]",
  designer: "bg-[hsl(var(--role-designer))] text-[hsl(var(--role-designer-foreground))]",
  developer: "bg-[hsl(var(--role-developer))] text-[hsl(var(--role-developer-foreground))]",
  submitter: "bg-[hsl(var(--role-submitter))] text-[hsl(var(--role-submitter-foreground))]",
  ba: "bg-[hsl(var(--role-pm))] text-[hsl(var(--role-pm-foreground))]",
  tech_lead: "bg-[hsl(var(--role-developer))] text-[hsl(var(--role-developer-foreground))]",
};

function AccountPanel({
  onSignOut,
  showViewMode,
}: {
  onSignOut: () => void;
  showViewMode?: boolean;
}) {
  const { user, roles } = useCurrentUser();
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  const roleLabels = roles.map(r => ROLE_BADGE_LABEL[r] ?? r).join(" · ");

  return (
    <div className="space-y-3">
      {user ? (
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
            {roleLabels && (
              <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{roleLabels}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground pb-2 border-b border-border">Account</div>
      )}
      {showViewMode && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">View mode</div>
          <MeModeToggle />
        </div>
      )}
      <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

export function TopBar() {
  const { user } = useCurrentUser();
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  const firstName = user?.name?.split(" ")[0] ?? "Account";
  useEffect(() => { installMeModeHotkey(); }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
  };

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card flex items-center px-3 md:px-4 gap-2 md:gap-4 sticky top-0 z-40 safe-top">
      <SidebarTrigger className="flex-shrink-0 h-10 w-10 md:h-9 md:w-9" />

      {!isMobile && (
        <div className="flex-1 max-w-xl">
          <GlobalSearch />
        </div>
      )}

      {isMobile && !searchOpen && <div className="flex-1" />}
      {isMobile && searchOpen && (
        <div className="flex-1 min-w-0">
          <GlobalSearch />
        </div>
      )}

      {!isMobile && user?.role && (() => {
        const extraRoles = (user.roles ?? []).filter(r => r !== user.role);
        const allLabels = [user.role, ...extraRoles].map(r => ROLE_BADGE_LABEL[r] ?? r).join(" · ");
        return (
          <span
            className={`inline-flex items-center px-2.5 h-6 rounded-full text-[11px] font-semibold ${ROLE_BADGE_STYLE[user.role] ?? ""}`}
            aria-label={`Your roles: ${allLabels}`}
            title={`Your roles: ${allLabels}`}
          >
            {ROLE_BADGE_LABEL[user.role]}
            {extraRoles.length > 0 && (
              <span className="ml-1.5 opacity-80">+{extraRoles.length}</span>
            )}
          </span>
        );
      })()}

      {!isMobile && (
        <>
          <DefaultViewMenu />
          <MeModeToggle />
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
          <PopoverContent align="end" className="w-72 z-50 bg-popover p-3">
            <AccountPanel onSignOut={handleSignOut} showViewMode />
          </PopoverContent>
        </Popover>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 border border-border hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-[220px]"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate">{firstName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 z-50 bg-popover p-3">
            <AccountPanel onSignOut={handleSignOut} />
          </PopoverContent>
        </Popover>
      )}
    </header>
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

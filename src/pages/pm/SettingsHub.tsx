import { Link } from "react-router-dom";
import { Bell, Columns, LayoutGrid, List, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MeModeToggle } from "@/components/pm/MeModeToggle";
import { SettingsSubnav } from "@/components/pm/SettingsSubnav";
import { useDefaultViewMode, type ViewMode } from "@/hooks/useViewMode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "list", label: "List", icon: <List className="h-4 w-4" /> },
  { value: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> },
  { value: "kanban", label: "Kanban", icon: <Columns className="h-4 w-4" /> },
];

export default function SettingsHub() {
  const { defaultMode, setDefault, resetAll } = useDefaultViewMode();
  return (
    <div className="max-w-3xl mx-auto page-shell space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Profile, notifications, and the view preferences already on the top bar — gathered in one place.
        </p>
      </div>
      <SettingsSubnav current="hub" />

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/pm/settings/profile" className="block">
          <Card className="p-4 h-full hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4" /> Profile
            </div>
            <p className="text-sm text-muted-foreground mt-1">Display name, photo, and avatar color.</p>
          </Card>
        </Link>
        <Link to="/pm/settings/notifications" className="block">
          <Card className="p-4 h-full hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2 font-medium">
              <Bell className="h-4 w-4" /> Notifications
            </div>
            <p className="text-sm text-muted-foreground mt-1">Choose in-app and email alerts per event type.</p>
          </Card>
        </Link>
      </div>

      <Card className="p-4 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Me mode</div>
          <MeModeToggle />
          <p className="text-xs text-muted-foreground mt-2">Same control as the top bar. Filters lists to work assigned to you.</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Default view</div>
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDefault(opt.value)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 h-8 rounded-md border text-sm",
                  defaultMode === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted border-border",
                )}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 text-xs px-0"
            onClick={() => { resetAll(); toast.success("Reset all view preferences"); }}
          >
            Reset all view preferences
          </Button>
          <p className="text-xs text-muted-foreground mt-1">Same default as the top-bar view menu.</p>
        </div>
      </Card>
    </div>
  );
}

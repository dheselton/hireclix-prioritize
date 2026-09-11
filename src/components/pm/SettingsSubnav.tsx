import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/pm/settings", label: "Settings", end: true },
  { to: "/pm/settings/profile", label: "Profile" },
  { to: "/pm/settings/notifications", label: "Notifications" },
  { to: "/pm/settings/milestones", label: "Milestones" },
];

export function SettingsSubnav({
  current,
}: {
  current: "hub" | "profile" | "notifications" | "milestones";
}) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {LINKS.map((l) => {
        const active =
          (current === "hub" && l.end) ||
          (current === "profile" && l.to.endsWith("/profile")) ||
          (current === "notifications" && l.to.endsWith("/notifications")) ||
          (current === "milestones" && l.to.endsWith("/milestones"));
        return (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              "rounded-md px-2.5 py-1 border",
              active
                ? "bg-accent text-accent-foreground font-medium border-border"
                : "text-muted-foreground border-transparent hover:bg-muted",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

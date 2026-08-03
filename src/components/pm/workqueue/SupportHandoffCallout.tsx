import { Link } from "react-router-dom";
import { Headphones, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { useProjectsReadyForSupport } from "@/lib/pm/supportMode";
import { fmtDate } from "@/lib/pm/format";

/**
 * Daily Briefing callout: shows career-site projects that have hit their
 * go-live date and are ready for the Support handoff. Visible to PM/BA only.
 * Every project row deep-links to the project so the PM can flip the switch.
 */
export function SupportHandoffCallout() {
  const { user } = useCurrentUser();
  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const canFlip = roles.some((r) => r === "pm" || r === "ba");
  const projects = useProjectsReadyForSupport();

  if (!canFlip || projects.length === 0) return null;

  return (
    <div className="rounded-lg border border-info/40 bg-info/5 px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-md bg-info/15 p-1.5 text-info">
          <Headphones className="h-4 w-4" />
        </div>
        <div className="text-sm font-medium text-foreground">
          Ready for Support handoff
          <span className="ml-2 text-xs text-muted-foreground">
            {projects.length} {projects.length === 1 ? "project has" : "projects have"} passed go-live
          </span>
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {projects.slice(0, 4).map((p) => (
          <li key={p.id}>
            <Link
              to={`/pm/projects/${p.id}`}
              className="flex items-center justify-between py-2 text-sm hover:bg-muted/40 rounded px-2 -mx-2 transition-colors"
            >
              <span className="truncate font-medium">{p.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-3">
                {p.go_live_date && <span>Live {fmtDate(p.go_live_date)}</span>}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {projects.length > 4 && (
        <div className="text-xs text-muted-foreground mt-2">
          + {projects.length - 4} more
        </div>
      )}
    </div>
  );
}


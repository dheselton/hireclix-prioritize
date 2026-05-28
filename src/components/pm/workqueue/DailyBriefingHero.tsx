import { Link } from "react-router-dom";
import { Zap, FolderOpen, AlertTriangle, Ban } from "lucide-react";
import { format } from "date-fns";
import { buildQueueLink } from "@/lib/pm/links";
import type { BriefingCounts } from "@/lib/pm/briefing";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface Props {
  firstName: string;
  counts: BriefingCounts;
}

export function DailyBriefingHero({ firstName, counts }: Props) {
  const dateLabel = format(new Date(), "EEEE, MMM d").toUpperCase();
  const hasOverdue = counts.overdue > 0;

  return (
    <div className="rounded-xl p-5 md:p-6 mb-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-md">
      <div className="text-[11px] font-semibold tracking-wider text-white/60 mb-1">
        {dateLabel}
      </div>
      <h1 className="text-xl md:text-2xl font-semibold leading-snug">
        {greeting()}, {firstName}.{" "}
        {hasOverdue ? (
          <span className="text-white/85">
            You have{" "}
            <span className="text-red-300 font-bold">
              {counts.overdue} overdue {counts.overdue === 1 ? "item" : "items"}
            </span>{" "}
            across your work.
          </span>
        ) : (
          <span className="text-white/85">You're on top of everything today.</span>
        )}
      </h1>

      <div className="flex flex-wrap gap-2 mt-4">
        <Chip
          to={buildQueueLink({ chips: ["assigned_to_me"], workType: "request", section: "quick-hits" })}
          icon={<Zap className="h-3.5 w-3.5" />}
          label={`${counts.quickTasks} Quick ${counts.quickTasks === 1 ? "Task" : "Tasks"}`}
        />
        <Chip
          to={buildQueueLink({ chips: ["assigned_to_me"], workType: "project", section: "project-work" })}
          icon={<FolderOpen className="h-3.5 w-3.5" />}
          label={`${counts.activeProjects} Active ${counts.activeProjects === 1 ? "Project" : "Projects"}`}
        />
        <Chip
          to={buildQueueLink({ chips: ["assigned_to_me", "overdue"] })}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label={`${counts.overdue} Overdue`}
          tone={counts.overdue > 0 ? "danger" : "default"}
        />
        {counts.blocked > 0 && (
          <Chip
            to={buildQueueLink({ chips: ["assigned_to_me", "blocked"] })}
            icon={<Ban className="h-3.5 w-3.5" />}
            label={`${counts.blocked} Blocked`}
            tone="warning"
          />
        )}
      </div>
    </div>
  );
}

function Chip({
  to,
  icon,
  label,
  tone = "default",
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "danger" | "warning";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-500/25 hover:bg-red-500/35 ring-1 ring-red-300/30"
      : tone === "warning"
      ? "bg-amber-500/25 hover:bg-amber-500/35 ring-1 ring-amber-300/30"
      : "bg-white/10 hover:bg-white/20";
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${toneClass}`}
    >
      {icon}
      {label}
    </Link>
  );
}

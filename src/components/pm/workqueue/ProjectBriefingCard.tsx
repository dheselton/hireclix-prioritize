import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { fmtDate } from "@/lib/pm/format";
import type { PmTask, PmProject } from "@/types/pm";

type ProjectWithMeta = PmProject & {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  my_top_tasks: PmTask[];
  my_total: number;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function taskUrgency(t: PmTask): "overdue" | "today" | "upcoming" | "none" {
  if (!t.due_date) return "none";
  const today = todayIso();
  if (t.due_date < today) return "overdue";
  if (t.due_date === today) return "today";
  return "upcoming";
}

export function ProjectBriefingCard({ project }: { project: ProjectWithMeta }) {
  const drawer = useTaskDrawerLink();
  const today = todayIso();
  const pct = project.total_tasks > 0
    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
    : 0;

  const status: "overdue" | "today" | "on_track" =
    project.overdue_tasks > 0
      ? "overdue"
      : project.go_live_date === today
      ? "today"
      : "on_track";

  const statusLabel =
    status === "overdue" ? "overdue" : status === "today" ? "due today" : "on track";
  const statusClass =
    status === "overdue"
      ? "text-destructive bg-destructive/10"
      : status === "today"
      ? "text-amber-700 bg-amber-500/15 dark:text-amber-300"
      : "text-emerald-700 bg-emerald-500/15 dark:text-emerald-300";

  const remaining = Math.max(0, project.my_total - project.my_top_tasks.length);

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-2 mb-1.5">
          <Link
            to={`/pm/projects/${project.id}`}
            className="text-sm font-semibold truncate flex-1 hover:underline"
          >
            {project.title}
          </Link>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClass}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusLabel}
          </span>
          <Link
            to={`/pm/projects/${project.id}`}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
          >
            Open <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-1 flex-1" />
          <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
          {project.go_live_date && (
            <span className="text-[11px] text-muted-foreground">Go-live {fmtDate(project.go_live_date)}</span>
          )}
        </div>
      </div>

      {/* My next up */}
      <div className="pt-1">
        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-2">
          MY NEXT UP ({project.my_top_tasks.length} OF {project.my_total})
        </div>
        {project.my_top_tasks.length === 0 ? (
          <div className="text-xs text-muted-foreground py-1.5">Nothing assigned to you here.</div>
        ) : (
          <div className="space-y-1.5">
            {project.my_top_tasks.map((t) => {
              const u = taskUrgency(t);
              const borderColor =
                u === "overdue" ? "border-l-destructive" :
                u === "today" ? "border-l-amber-500" :
                u === "upcoming" ? "border-l-primary" : "border-l-muted-foreground/40";
              const dot =
                u === "overdue" ? "bg-destructive" :
                u === "today" ? "bg-amber-500" :
                u === "upcoming" ? "bg-primary" : "bg-muted-foreground/40";
              const badge =
                u === "overdue" ? <span className="text-[10px] font-semibold text-destructive">{fmtDate(t.due_date)}</span> :
                u === "today" ? <span className="text-[10px] font-semibold text-amber-600">Today</span> :
                t.due_date ? <span className="text-[10px] text-muted-foreground">{fmtDate(t.due_date)}</span> :
                <span className="text-[10px] text-muted-foreground">No date</span>;
              return (
                <button
                  key={t.id}
                  onClick={() => drawer.open(t.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 hover:bg-muted border-l-[3px] ${borderColor} text-left transition-colors`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                  <span className="flex-1 min-w-0 text-xs font-medium truncate">{t.title}</span>
                  <span className="shrink-0">{badge}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-muted-foreground">
          {remaining > 0 ? `+ ${remaining} more of mine` : ""}
        </span>
        <Link
          to={`/pm/projects/${project.id}`}
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Open project <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}

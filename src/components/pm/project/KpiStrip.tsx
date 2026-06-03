import { Link } from "react-router-dom";
import { fmtDate } from "@/lib/pm/format";
import { buildQueueLink } from "@/lib/pm/links";
import type { PmProject, PmTask } from "@/types/pm";

export function KpiStrip({ project, tasks }: { project: PmProject; tasks: PmTask[] }) {
  const done = tasks.filter(t => t.status === "complete" || t.status === "approved").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "complete" && t.status !== "approved").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const open = tasks.filter(t => t.status !== "complete" && t.status !== "approved").length;

  const Item = ({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${className}`}>{value}</span>
    </div>
  );

  const LinkItem = ({ to, label, value, className = "" }: { to: string; label: string; value: React.ReactNode; className?: string }) => (
    <Link to={to} className="flex items-baseline gap-1.5 hover:underline underline-offset-2 rounded">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${className}`}>{value}</span>
    </Link>
  );

  return (
    <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-foreground">
      <Item label="Go-live" value={fmtDate(project.go_live_date) || "—"} />
      <Item label="Progress" value={`${pct}%`} />
      <LinkItem to={buildQueueLink({ chips: ["overdue"] })} label="Overdue" value={overdue} className="text-destructive" />
      <LinkItem to={buildQueueLink({ chips: ["blocked"] })} label="Blocked" value={blocked} className="text-warning" />
      <LinkItem to={`/pm/projects/${project.id}`} label="Open" value={open} className="text-muted-foreground" />
    </div>
  );
}

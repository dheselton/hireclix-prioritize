import { fmtDate } from "@/lib/pm/format";
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

  return (
    <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-foreground">
      <Item label="Go-live" value={fmtDate(project.go_live_date) || "—"} />
      <Item label="Progress" value={`${pct}%`} />
      <Item label="Overdue" value={overdue} className="text-destructive" />
      <Item label="Blocked" value={blocked} className="text-warning" />
      <Item label="Open" value={open} className="text-muted-foreground" />
    </div>
  );
}

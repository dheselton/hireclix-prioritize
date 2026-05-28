import { Link } from "react-router-dom";
import { Zap, ArrowRight, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { buildQueueLink } from "@/lib/pm/links";
import { fmtDate } from "@/lib/pm/format";
import type { PmTask } from "@/types/pm";

type QuickTask = PmTask & { project_title: string | null };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function urgency(t: PmTask): "overdue" | "today" | "upcoming" | "none" {
  if (!t.due_date) return "none";
  const today = todayIso();
  if (t.due_date < today) return "overdue";
  if (t.due_date === today) return "today";
  return "upcoming";
}

interface Props {
  tasks: QuickTask[];
  totalCount: number;
  unclaimed: QuickTask[];
}

function MyTaskRow({ t, onOpen }: { t: QuickTask; onOpen: (id: string) => void }) {
  const u = urgency(t);
  const dot =
    u === "overdue" ? "bg-destructive" :
    u === "today" ? "bg-amber-500" :
    u === "upcoming" ? "bg-primary" : "bg-muted-foreground/40";
  const badge =
    u === "overdue" ? <span className="text-[10px] font-semibold text-destructive">Overdue</span> :
    u === "today" ? <span className="text-[10px] font-semibold text-amber-600">Today</span> :
    t.due_date ? <span className="text-[10px] text-muted-foreground">{fmtDate(t.due_date)}</span> :
    <span className="text-[10px] text-muted-foreground">No date</span>;
  return (
    <button
      onClick={() => onOpen(t.id)}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-transparent hover:border-primary/40 hover:bg-accent/40 transition-colors text-left"
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{t.title}</div>
        {t.project_title && (
          <div className="text-[11px] text-muted-foreground truncate">{t.project_title}</div>
        )}
      </div>
      <div className="shrink-0">{badge}</div>
    </button>
  );
}

function UnclaimedRow({ t, onOpen }: { t: QuickTask; onOpen: (id: string) => void }) {
  const u = urgency(t);
  const badge =
    u === "overdue" ? <span className="text-[10px] font-semibold text-destructive">Overdue</span> :
    u === "today" ? <span className="text-[10px] font-semibold text-amber-600">Today</span> :
    t.due_date ? <span className="text-[10px] text-muted-foreground">{fmtDate(t.due_date)}</span> :
    null;
  return (
    <div className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-amber-500/5 border border-amber-500/30 border-l-4 border-l-amber-500 hover:bg-amber-500/10 transition-colors">
      <span className="h-2 w-2 rounded-full shrink-0 bg-amber-500 unclaimed-pulse" />
      <button
        onClick={() => onOpen(t.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-sm font-medium truncate">{t.title}</div>
        {t.project_title && (
          <div className="text-[11px] text-muted-foreground truncate">{t.project_title}</div>
        )}
      </button>
      {badge && <div className="shrink-0">{badge}</div>}
      <ClaimButton task={t} size="sm" />
    </div>
  );
}

export function QuickTasksColumn({ tasks, totalCount, unclaimed }: Props) {
  const drawer = useTaskDrawerLink();
  const remaining = Math.max(0, totalCount - tasks.length);

  return (
    <Card className="p-4 flex flex-col min-h-0 max-h-[55vh]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> QUICK TASKS
        </h2>
        <span className="text-[11px] text-muted-foreground">{totalCount}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
        {unclaimed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <div className="text-[10px] font-semibold tracking-wider text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                <Inbox className="h-3 w-3" /> UNCLAIMED · {unclaimed.length}
              </div>
            </div>
            <div className="space-y-1.5">
              {unclaimed.map((t) => (
                <UnclaimedRow key={t.id} t={t} onOpen={drawer.open} />
              ))}
            </div>
          </div>
        )}

        <div>
          {unclaimed.length > 0 && (
            <div className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-1.5 px-0.5">
              MY QUICK TASKS · {totalCount}
            </div>
          )}
          {tasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {unclaimed.length > 0 ? "Nothing claimed by you yet." : "No quick tasks. Nice work."}
            </div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((t) => (
                <MyTaskRow key={t.id} t={t} onOpen={drawer.open} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60 shrink-0">
        <span className="text-[11px] text-muted-foreground">
          {remaining > 0 ? `${remaining} more in queue` : ""}
        </span>
        <Link
          to={buildQueueLink({ chips: ["assigned_to_me"], workType: "request", section: "quick-hits" })}
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}

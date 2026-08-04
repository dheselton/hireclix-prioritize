import { Link } from "react-router-dom";
import { Zap, ArrowRight, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { TaskTriagePopover } from "@/components/pm/TaskTriagePopover";
import { buildQueueLink } from "@/lib/pm/links";
import { fmtDate } from "@/lib/pm/format";
import type { EnrichedQuickTask } from "@/lib/pm/briefing";


type QuickTask = EnrichedQuickTask;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function urgency(t: QuickTask): "overdue" | "today" | "upcoming" | "none" {
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

function isCareerSiteType(v: string | null) {
  return typeof v === "string" && v.startsWith("careersite_");
}

function careerSiteLabel(v: string) {
  const sub = v.replace(/^careersite_/, "");
  const map: Record<string, string> = {
    bug: "Bug fix",
    content: "Content change",
    jobfeed: "API / Job feed",
    new_page: "New page",
    sow: "SOW project",
    support: "General support",
    update: "Update",
  };
  return map[sub] ?? sub.replace(/_/g, " ");
}

function TypePill({ value }: { value: string | null }) {
  if (!value) return null;
  if (isCareerSiteType(value)) {
    return (
      <span className="careersite-pill shrink-0">
        Career Site · {careerSiteLabel(value)}
      </span>
    );
  }
  return (
    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
      {value.replace(/_/g, " ")}
    </span>
  );
}

function MetaRow({ t }: { t: QuickTask }) {
  const parts: string[] = [];
  if (t.client_name) parts.push(t.client_name);
  if (t.project_title && t.project_title !== t.client_name) parts.push(t.project_title);
  return (
    <div className="flex items-center gap-1.5 mt-0.5 min-w-0 flex-wrap">
      <TypePill value={t.request_type} />
      {parts.length > 0 && (
        <span className="text-[11px] text-muted-foreground truncate">
          {parts.join(" · ")}
        </span>
      )}
    </div>
  );
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
    <div className="card-lift w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md border border-border bg-card text-left group">
      <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${dot}`} />
      <button onClick={() => onOpen(t.id)} className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          <PriorityFlag priority={t.priority} size="xs" />
          <span className="truncate">{t.title}</span>
        </div>
        <MetaRow t={t} />
      </button>

      <div className="shrink-0 mt-0.5">{badge}</div>
      <div className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <TaskTriagePopover task={t} />
      </div>
    </div>
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
    <div className="card-lift w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-amber-500/5 border border-amber-500/40 border-l-4 border-l-amber-500">
      <span className="h-2 w-2 rounded-full shrink-0 mt-1.5 bg-amber-500 unclaimed-pulse" />
      <button
        onClick={() => onOpen(t.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          <PriorityFlag priority={t.priority} size="xs" />
          <span className="truncate">{t.title}</span>
        </div>
        <MetaRow t={t} />
      </button>

      {badge && <div className="shrink-0 mt-0.5">{badge}</div>}
      <div className="mt-0.5"><ClaimButton task={t} size="sm" /></div>
    </div>
  );
}

export function QuickTasksColumn({ tasks, totalCount, unclaimed }: Props) {
  const drawer = useTaskDrawerLink();
  const remaining = Math.max(0, totalCount - tasks.length);

  return (
    <Card className="p-4 flex flex-col min-h-0 max-h-[55vh]">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> QUICK TASKS
        </h2>
        <span className="text-[11px] text-muted-foreground">{totalCount}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Single-task work from quick requests.</p>

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

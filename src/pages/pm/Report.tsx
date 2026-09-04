import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3, AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, PlusCircle, Inbox, Activity,
} from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { buildQueueLink, projectFilterLink } from "@/lib/pm/links";
import { fmtDate } from "@/lib/pm/format";
import { useMockUsers } from "@/lib/pm/mockUser";
import { useReportData, computeAtRisk, isOverdue, startOfToday, daysSince } from "@/lib/pm/report";
import { isDone, type PmProject, type PmTask } from "@/types/pm";
import { cn } from "@/lib/utils";
import { WorkLoadError, WorkPageSkeleton } from "@/components/pm/WorkLoadingState";

/* ------------------------------------------------------------------ */

function PanelShell({
  title, icon: Icon, hint, children,
}: { title: string; icon: any; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" /> {title}
          </h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** A number that opens the exact set it counts — inline, right here. */
function StatTile({
  label, count, open, onToggle, tasks, projects, projById,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  tasks?: PmTask[];
  projects?: PmProject[];
  projById: Map<string, PmProject>;
}) {
  const empty = count === 0;
  return (
    <div className={cn("rounded-lg border border-border min-w-0 overflow-hidden", open && "bg-muted/30")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={empty}
        className={cn(
          "w-full text-left p-3 flex items-center justify-between gap-2 rounded-lg min-w-0",
          empty ? "opacity-60 cursor-default" : "hover:bg-accent/60",
        )}
      >
        <span className="min-w-0">
          <span className="block text-2xl font-semibold tabular-nums">{count}</span>
          <span className="block text-xs text-muted-foreground truncate">{label}</span>
        </span>
        {!empty && (open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />)}
      </button>
      {open && (
        <ul className="border-t border-border divide-y divide-border/60">
          {(tasks ?? []).map(t => (
            <li key={t.id} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
              <Link to={`/pm/tasks/${t.id}`} className="hover:underline truncate">{t.title}</Link>
              <span className="text-muted-foreground shrink-0 truncate max-w-[45%]">
                {projById.get(t.project_id)?.title ?? ""}
              </span>
            </li>
          ))}
          {(projects ?? []).map(p => (
            <li key={p.id} className="px-3 py-1.5 text-xs">
              <Link to={`/pm/projects/${p.id}`} className="hover:underline">{p.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Report() {
  const { loading, error, reload, tasks, projects, clientNames, lastActivity, weekStart } = useReportData();
  const users = useMockUsers();
  const [openTile, setOpenTile] = useState<string | null>(null);

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const today = startOfToday();
  const weekIso = weekStart.toISOString();

  const thisWeek = useMemo(() => {
    const completed = tasks.filter(t => isDone(t.status) && t.updated_at >= weekIso);
    const added = tasks.filter(t => t.created_at >= weekIso);
    const requests = projects.filter(p => p.work_type === "request" && p.created_at >= weekIso);
    const movedIds = new Set<string>();
    lastActivity.forEach((iso, pid) => { if (iso >= weekIso) movedIds.add(pid); });
    const moved = projects.filter(p => movedIds.has(p.id));
    return { completed, added, requests, moved };
  }, [tasks, projects, lastActivity, weekIso]);

  const overdueTasks = useMemo(() => tasks.filter(t => isOverdue(t, today)), [tasks, today]);
  const pushedOverdue = useMemo(
    () => overdueTasks.filter(t => (t.due_date_changes ?? 0) > 0).length,
    [overdueTasks],
  );

  const byPerson = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    for (const t of overdueTasks) {
      const key = t.assignee_id ?? "__unassigned";
      const arr = map.get(key);
      arr ? arr.push(t) : map.set(key, [t]);
    }
    return [...map.entries()]
      .map(([userId, list]) => ({
        userId,
        user: users.find(u => u.id === userId) ?? null,
        list,
        oldest: list.reduce<string | null>((acc, t) => (!acc || (t.due_date ?? "") < acc ? t.due_date ?? acc : acc), null),
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [overdueTasks, users]);

  const byClient = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    for (const t of overdueTasks) {
      const cid = projById.get(t.project_id)?.client_id ?? "__none";
      const arr = map.get(cid);
      arr ? arr.push(t) : map.set(cid, [t]);
    }
    return [...map.entries()]
      .map(([clientId, list]) => ({
        clientId,
        name: clientId === "__none" ? "No client" : clientNames.get(clientId) ?? "Unknown client",
        list,
        projectCount: new Set(list.map(t => t.project_id)).size,
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [overdueTasks, projById, clientNames]);

  const atRisk = useMemo(
    () => computeAtRisk(projects, tasks, clientNames, lastActivity),
    [projects, tasks, clientNames, lastActivity],
  );

  const toggle = (id: string) => setOpenTile(prev => (prev === id ? null : id));

  if (loading) {
    return <WorkPageSkeleton />;
  }
  if (error) {
    return <div className="page-shell"><WorkLoadError retry={reload} /></div>;
  }

  return (
    <div className="page-shell max-w-[1200px] mx-auto space-y-4">
      <header className="space-y-1 min-w-0">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary shrink-0" /> Team Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Week of {fmtDate(weekStart.toISOString())} — every number opens the work behind it.
        </p>
      </header>

      {/* 1 — This week */}
      <PanelShell title="This week" icon={Activity} hint="Since Monday. Click a number to see the items.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
          <StatTile
            label="Tasks completed" count={thisWeek.completed.length}
            open={openTile === "completed"} onToggle={() => toggle("completed")}
            tasks={thisWeek.completed} projById={projById}
          />
          <StatTile
            label="Tasks added" count={thisWeek.added.length}
            open={openTile === "added"} onToggle={() => toggle("added")}
            tasks={thisWeek.added} projById={projById}
          />
          <StatTile
            label="Requests received" count={thisWeek.requests.length}
            open={openTile === "requests"} onToggle={() => toggle("requests")}
            projects={thisWeek.requests} projById={projById}
          />
          <StatTile
            label="Projects with movement" count={thisWeek.moved.length}
            open={openTile === "moved"} onToggle={() => toggle("moved")}
            projects={thisWeek.moved} projById={projById}
          />
        </div>
      </PanelShell>

      {/* 2 — Overdue by person */}
      <PanelShell
        title="Overdue by person" icon={AlertTriangle}
        hint={`${overdueTasks.length} unclaimed/claimed overdue task${overdueTasks.length === 1 ? "" : "s"} across the team${pushedOverdue ? ` · ${pushedOverdue} previously pushed` : ""}.`}
      >
        {byPerson.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Nobody is overdue. Nice.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {byPerson.map(row => (
              <li key={row.userId}>
                <Link
                  to={row.userId === "__unassigned"
                    ? buildQueueLink({ chips: ["overdue", "unclaimed"] })
                    : `${buildQueueLink({ chips: ["overdue"] })}&user=${row.userId}`}
                  className="flex items-center gap-3 py-2 px-1 rounded hover:bg-accent/60 transition"
                >
                  {row.user
                    ? <UserAvatar userId={row.user.id} size="sm" />
                    : <span className="h-6 w-6 rounded-full bg-muted inline-block" />}
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {row.user?.name ?? "Unassigned"}
                  </span>
                  {row.oldest && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      oldest due {fmtDate(row.oldest)}
                    </span>
                  )}
                  <span className="text-sm font-semibold tabular-nums text-destructive">{row.list.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>

      {/* 3 — Projects at risk */}
      <PanelShell
        title="Projects at risk" icon={AlertTriangle}
        hint="Go-live within 14 days with overdue work, 2+ blocked tasks, or no movement in 5+ days."
      >
        {atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> No projects at risk — everything looks healthy.
          </p>
        ) : (
          <div className="space-y-2">
            {atRisk.map(r => (
              <div key={r.project.id} className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <Link to={`/pm/projects/${r.project.id}`} className="text-sm font-medium hover:underline">
                    {r.project.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs">
                    {r.overdue > 0 && (
                      <Link
                        to={projectFilterLink(r.project.id, "overdue")}
                        className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold hover:underline"
                      >
                        {r.overdue} overdue
                      </Link>
                    )}
                    {r.blocked > 0 && (
                      <Link
                        to={projectFilterLink(r.project.id, "blocked")}
                        className="px-1.5 py-0.5 rounded bg-warning/10 text-warning font-semibold hover:underline"
                      >
                        {r.blocked} blocked
                      </Link>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {r.clientName && <span>{r.clientName}</span>}
                  <span>Go-live {fmtDate(r.project.go_live_date)}</span>
                  <span>
                    Last activity {r.lastActivityIso ? fmtDate(r.lastActivityIso) : "—"}
                    {r.staleDays !== null && ` (${r.staleDays}d ago)`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.reasons.map(reason => (
                    <span key={reason} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelShell>

      {/* 4 — Overdue by client */}
      <PanelShell title="Overdue by client" icon={Inbox} hint="Which accounts are feeling the delay.">
        {byClient.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> No overdue work for any client.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {byClient.map(row => (
              <li key={row.clientId}>
                <Link
                  to={row.clientId === "__none"
                    ? buildQueueLink({ chips: ["overdue"] })
                    : `${buildQueueLink({ chips: ["overdue"] })}&client=${row.clientId}`}
                  className="flex items-center gap-3 py-2 px-1 rounded hover:bg-accent/60 transition"
                >
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{row.name}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {row.projectCount} project{row.projectCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-destructive">{row.list.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>
    </div>
  );
}

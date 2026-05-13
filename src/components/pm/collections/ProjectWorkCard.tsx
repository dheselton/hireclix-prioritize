import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Play, AlertTriangle, Calendar, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/pm/format";
import { fmtAgo, getResumeForProject, onActivityChanged } from "@/lib/pm/activity";
import { StatusPill } from "@/components/pm/StatusPill";
import { ClaimButton } from "@/components/pm/ClaimButton";
import type { PmProject, PmTask } from "@/types/pm";

interface Props {
  project: PmProject;
  tasks: PmTask[];        // already filtered to "user's slice" for this project
  meId: string | null;
  onOpenTask: (id: string) => void;
  onOpenProject: (id: string) => void;
}

const COLLAPSE_KEY = (pid: string) => `pm.workCard.expanded.${pid}`;

function isOverdue(t: PmTask) {
  if (!t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString());
}
function isDueThisWeek(t: PmTask) {
  if (!t.due_date) return false;
  const d = new Date(t.due_date);
  const now = new Date();
  const in7 = new Date(); in7.setDate(now.getDate() + 7);
  return d >= now && d <= in7;
}
function isActive(t: PmTask) { return t.status !== "complete" && t.status !== "approved"; }

function rank(t: PmTask) {
  if (t.status === "blocked") return 0;
  if (isOverdue(t)) return 1;
  if (isDueThisWeek(t)) return 2;
  if (t.due_date) return 3;
  return 4;
}

export function ProjectWorkCard({ project, tasks, meId, onOpenTask, onOpenProject }: Props) {
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY(project.id)) === "1";
  });
  const [, force] = useState(0);
  useEffect(() => onActivityChanged(() => force(v => v + 1)), []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    try { window.localStorage.setItem(COLLAPSE_KEY(project.id), next ? "1" : "0"); } catch {}
  }

  const resume = useMemo(() => {
    const entry = getResumeForProject(meId, project.id);
    if (!entry) return null;
    return tasks.find(t => t.id === entry.taskId && isActive(t)) ? entry : null;
  }, [meId, project.id, tasks]);

  const sorted = useMemo(() => {
    const active = tasks.filter(isActive);
    return [...active].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      const ad = a.due_date ?? "9999-12-31";
      const bd = b.due_date ?? "9999-12-31";
      return ad.localeCompare(bd);
    });
  }, [tasks]);

  const counts = useMemo(() => {
    let overdue = 0, week = 0, blocked = 0, upcoming = 0, unclaimed = 0;
    for (const t of sorted) {
      if (t.status === "unclaimed") unclaimed++;
      if (t.status === "blocked") blocked++;
      else if (isOverdue(t)) overdue++;
      else if (isDueThisWeek(t)) week++;
      else upcoming++;
    }
    return { overdue, week, blocked, upcoming, unclaimed, total: sorted.length };
  }, [sorted]);

  const health: "overdue" | "at_risk" | "on_track" | "idle" =
    counts.overdue > 0 ? "overdue"
    : counts.blocked > 0 ? "at_risk"
    : counts.total === 0 ? "idle"
    : "on_track";

  const HEALTH_LABEL: Record<typeof health, string> = {
    overdue: "overdue", at_risk: "at risk", on_track: "on track", idle: "idle",
  };
  const HEALTH_DOT: Record<typeof health, string> = {
    overdue: "health-dot-red", at_risk: "health-dot-violet",
    on_track: "health-dot-emerald", idle: "health-dot-slate",
  };

  // Hide resume task from "next up" rows but keep it counted.
  const visibleTop = sorted.filter(t => t.id !== resume?.taskId);
  const top = expanded ? visibleTop : visibleTop.slice(0, 3);
  const hidden = visibleTop.length - top.length;

  return (
    <Card className={cn(
      "relative overflow-hidden transition hover:shadow-md",
      counts.unclaimed > 0 && "ring-1 ring-amber-400/40",
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <button
            className="text-left flex-1 group"
            onClick={() => onOpenProject(project.id)}
          >
            <div className="font-semibold leading-tight group-hover:underline">{project.title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] capitalize">{project.type.replace(/_/g," ")}</Badge>
              {project.go_live_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Go-live {fmtDate(project.go_live_date)}
                </span>
              )}
            </div>
          </button>
          <div className="text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn("h-2 w-2 rounded-full", HEALTH_DOT[health])} />
            <span className="text-muted-foreground">{HEALTH_LABEL[health]}</span>
          </div>
        </div>

        {/* Resume */}
        {resume && (() => {
          const t = tasks.find(x => x.id === resume.taskId);
          if (!t) return null;
          return (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pick up where you left off</div>
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-[11px] text-muted-foreground">edited {fmtAgo(resume.at)}</div>
              </div>
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onOpenTask(t.id); }}>
                Resume
              </Button>
            </div>
          );
        })()}

        {/* Counts strip */}
        {counts.total > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {counts.overdue > 0 && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full health-dot-red" /> {counts.overdue} overdue</span>}
            {counts.week > 0 && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full health-dot-amber" /> {counts.week} this week</span>}
            {counts.blocked > 0 && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full health-dot-violet" /> {counts.blocked} blocked</span>}
            {counts.upcoming > 0 && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full health-dot-slate" /> {counts.upcoming} upcoming</span>}
            {counts.unclaimed > 0 && <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><Inbox className="h-3 w-3" /> {counts.unclaimed} unclaimed</span>}
          </div>
        )}

        {/* Next up rows */}
        {top.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {expanded ? `All work (${visibleTop.length})` : `My next up (${Math.min(3, visibleTop.length)} of ${visibleTop.length})`}
            </div>
            {top.map(t => {
              const overdue = isOverdue(t);
              return (
                <button
                  key={t.id}
                  onClick={() => onOpenTask(t.id)}
                  className={cn(
                    "w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 hover:bg-muted/50 transition border border-transparent",
                    t.status === "unclaimed" && "unclaimed-row",
                    t.track === "pm" && "track-border-pm",
                    t.track === "production" && t.status !== "unclaimed" && "track-border-production",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate flex items-center gap-1.5">
                      {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                      {t.title}
                    </div>
                  </div>
                  <StatusPill status={t.status} />
                  <span className={cn("text-[11px] tabular-nums whitespace-nowrap", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                    {t.due_date ? fmtDate(t.due_date) : "—"}
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ClaimButton task={t} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {counts.total === 0 && !resume && (
          <div className="text-xs text-muted-foreground italic py-2">No active work for you here.</div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {hidden > 0 ? (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggle}>
              + {hidden} more
            </Button>
          ) : expanded && visibleTop.length > 3 ? (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggle}>
              Show less
            </Button>
          ) : <span />}
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onOpenProject(project.id)}>
            Open project <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

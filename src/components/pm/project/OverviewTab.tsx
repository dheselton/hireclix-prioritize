import { Link } from "react-router-dom";
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/pm/project/RichTextEditor";
import { fmtDate, fmtDateShort, todayISO } from "@/lib/pm/format";
import { projectFilterLink, projectTimeLink } from "@/lib/pm/links";
import { updateProject } from "@/lib/pm/api";
import { notifyNewMentions } from "@/lib/pm/notifications";
import { fmtDur } from "@/lib/pm/time";
import { canSeeProjectTimeTotal, useProjectTimeTotal } from "@/lib/pm/projectTime";
import { useProjectAttachments } from "@/lib/pm/projectAttachments";
import { labelProjectActivity, useProjectActivity } from "@/lib/pm/projectActivity";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { UserAvatar } from "@/components/pm/UserAvatar";
import {
  AlertTriangle, CalendarClock, MessageSquare, Clock, Paperclip,
  ExternalLink, Activity,
} from "lucide-react";
import type { PmProject, PmTask } from "@/types/pm";

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86400000);
}

function nextMilestone(project: PmProject): { label: string; date: string; days: number } | null {
  const candidates: { label: string; date: string }[] = [];
  if (project.kickoff_date) candidates.push({ label: "Kickoff", date: project.kickoff_date });
  if (project.start_date) candidates.push({ label: "Client review", date: project.start_date });
  if (project.go_live_date) candidates.push({ label: "Go-live", date: project.go_live_date });
  const upcoming = candidates
    .map((c) => ({ ...c, days: daysUntil(c.date)! }))
    .filter((c) => c.days !== null && c.days >= 0)
    .sort((a, b) => a.days - b.days);
  return upcoming[0] ?? null;
}

export function OverviewTab({ project, tasks, onProjectChange, onGoLiveChange: _onGoLiveChange, isPM: _isPM, reload: _reload }: {
  project: PmProject;
  tasks: PmTask[];
  onProjectChange: (p: PmProject) => void;
  onGoLiveChange: (d: string) => void;
  isPM: boolean;
  reload: () => void;
}) {
  const today = todayISO();
  const done = tasks.filter(t => t.status === "complete" || t.status === "approved").length;
  const open = tasks.filter(t => t.status !== "complete" && t.status !== "approved").length;
  const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "complete" && t.status !== "approved").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const inReview = tasks.filter(t => t.status === "in_review").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const goLiveDays = daysUntil(project.go_live_date);
  const kickoffDays = daysUntil(project.kickoff_date);
  const milestone = nextMilestone(project);

  const { roles } = useCurrentUser();
  const showTime = canSeeProjectTimeTotal(roles);
  const timeMinutes = useProjectTimeTotal(showTime ? project.id : null);
  const { files } = useProjectAttachments(project.id);
  const { events } = useProjectActivity(project.id, 6);
  const users = useMockUsers();
  const savedDescRef = useRef(project.description ?? "");
  const taskTitle = (id: string | null) =>
    id ? (tasks.find((t) => t.id === id)?.title ?? null) : null;

  const callouts: { tone: "warning" | "destructive" | "info"; icon: React.ReactNode; msg: React.ReactNode; href: string }[] = [];
  if (overdue > 0) {
    callouts.push({
      tone: "destructive", icon: <AlertTriangle className="h-4 w-4" />,
      msg: <><strong>{overdue}</strong> overdue {overdue === 1 ? "task" : "tasks"}</>,
      href: projectFilterLink(project.id, "overdue"),
    });
  }
  if (blocked > 0) {
    callouts.push({
      tone: "warning", icon: <AlertTriangle className="h-4 w-4" />,
      msg: <><strong>{blocked}</strong> blocked {blocked === 1 ? "task" : "tasks"}</>,
      href: projectFilterLink(project.id, "blocked"),
    });
  }
  if (goLiveDays !== null && goLiveDays >= 0 && goLiveDays <= 7) {
    callouts.push({
      tone: "warning", icon: <CalendarClock className="h-4 w-4" />,
      msg: <>Go-live in <strong>{goLiveDays}</strong> {goLiveDays === 1 ? "day" : "days"}</>,
      href: projectFilterLink(project.id, "open"),
    });
  } else if (kickoffDays !== null && kickoffDays >= 0 && kickoffDays <= 7) {
    callouts.push({
      tone: "warning", icon: <CalendarClock className="h-4 w-4" />,
      msg: <>Kickoff in <strong>{kickoffDays}</strong> {kickoffDays === 1 ? "day" : "days"}</>,
      href: projectFilterLink(project.id, "open"),
    });
  }
  if (inReview > 0) {
    callouts.push({
      tone: "info", icon: <MessageSquare className="h-4 w-4" />,
      msg: <>Waiting on client review · <strong>{inReview}</strong> {inReview === 1 ? "task" : "tasks"}</>,
      href: projectFilterLink(project.id, "in_review"),
    });
  }
  if (!callouts.length) {
    callouts.push({
      tone: "info", icon: <MessageSquare className="h-4 w-4" />,
      msg: <>All clear — no urgent items.</>,
      href: projectFilterLink(project.id),
    });
  }

  const toneBorder = (t: string) => t === "warning" ? "border-warning" : t === "destructive" ? "border-destructive" : "border-info";
  const toneText = (t: string) => t === "warning" ? "text-warning" : t === "destructive" ? "text-destructive" : "text-info";

  const recentFiles = files.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Health metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MiniMetric label="Progress" value={`${pct}%`} />
        <MiniMetric label="Open" value={open} to={projectFilterLink(project.id, "open")} />
        <MiniMetric label="Done" value={done} to={projectFilterLink(project.id, "done")} />
        <MiniMetric label="Overdue" value={overdue} to={projectFilterLink(project.id, "overdue")} danger={overdue > 0} />
        <MiniMetric label="Blocked" value={blocked} to={projectFilterLink(project.id, "blocked")} warn={blocked > 0} />
        <MiniMetric label="In review" value={inReview} to={projectFilterLink(project.id, "in_review")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        {/* Left */}
        <div className="space-y-4">
          <Card className="bg-secondary">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Start here</div>
                {milestone && (
                  <div className="text-xs text-muted-foreground">
                    Next: <span className="font-medium text-foreground">{milestone.label}</span>
                    {" · "}
                    <span className="tabular-nums">{fmtDate(milestone.date)}</span>
                    {milestone.days === 0 ? " (today)" : ` (${milestone.days}d)`}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {callouts.slice(0, 4).map((c, i) => (
                  <Link key={i} to={c.href}
                    className={`flex items-center gap-2.5 bg-background rounded px-3 py-2 border-l-[3px] ${toneBorder(c.tone)} hover:bg-background/80 transition`}>
                    <span className={toneText(c.tone)}>{c.icon}</span>
                    <span className="text-sm">{c.msg}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {showTime && (
            <Card className="bg-secondary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Time tracked
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">{fmtDur(timeMinutes)}</div>
                    <p className="text-xs text-muted-foreground">
                      All-time total across every task on this project.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={projectTimeLink(project.id)}>
                      View in timesheet
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-secondary">
            <CardContent className="p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Brief</div>
              <RichTextEditor
                value={project.description ?? ""}
                onChange={(html) => onProjectChange({ ...project, description: html })}
                onBlur={() => {
                  const next = project.description ?? "";
                  const prev = savedDescRef.current;
                  updateProject(project.id, { description: next });
                  notifyNewMentions({
                    prevHtml: prev,
                    nextHtml: next,
                    title: `mentioned you in ${project.title}`,
                    link: `/pm/projects/${project.id}`,
                  }).catch(() => {});
                  savedDescRef.current = next;
                }}
                placeholder="Project brief…"
                users={users}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <Card className="bg-secondary">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Attachments
                  {files.length > 0 && (
                    <span className="normal-case tracking-normal text-muted-foreground/80">({files.length})</span>
                  )}
                </div>
                <Link
                  to={`/pm/projects/${project.id}?tab=files`}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  View all <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {recentFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No files yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recentFiles.map((f) => {
                    const src = f.is_project_level
                      ? "Project"
                      : (taskTitle(f.task_id) ?? "Task");
                    return (
                      <li key={`${f.is_project_level ? "p" : "t"}-${f.id}`}>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-background transition"
                        >
                          <Paperclip className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium truncate block">{f.label || f.name}</span>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {src} · {fmtDateShort(f.created_at.slice(0, 10))}
                            </span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-secondary">
            <CardContent className="p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Recent activity
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No recent movement logged.</p>
              ) : (
                <ul className="space-y-2">
                  {events.map((e) => {
                    const actor = e.user_id ? users.find((u) => u.id === e.user_id) : null;
                    return (
                      <li key={e.id} className="flex items-start gap-2 text-sm">
                        {e.user_id ? (
                          <UserAvatar userId={e.user_id} size="sm" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate">
                            <span className="font-medium">{actor?.name ?? "Someone"}</span>
                            {" "}
                            <span className="text-muted-foreground">{labelProjectActivity(e.action, e.payload)}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {fmtDate(e.created_at.slice(0, 10))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label, value, to, danger, warn,
}: {
  label: string;
  value: React.ReactNode;
  to?: string;
  danger?: boolean;
  warn?: boolean;
}) {
  const valueClass = danger ? "text-destructive" : warn ? "text-warning" : "";
  const body = (
    <CardContent className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold leading-tight mt-0.5 tabular-nums ${valueClass}`}>{value}</div>
    </CardContent>
  );
  if (!to) return <Card className="bg-secondary">{body}</Card>;
  return (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="bg-secondary hover:bg-secondary/70 transition cursor-pointer h-full">{body}</Card>
    </Link>
  );
}

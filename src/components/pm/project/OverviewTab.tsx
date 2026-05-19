import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { RichTextEditor } from "@/components/pm/project/RichTextEditor";
import { fmtDate } from "@/lib/pm/format";
import { buildQueueLink } from "@/lib/pm/links";
import { updateProject } from "@/lib/pm/api";
import { AlertTriangle, CalendarClock, MessageSquare } from "lucide-react";
import type { PmProject, PmTask } from "@/types/pm";

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86400000);
}

export function OverviewTab({ project, tasks, onProjectChange, onGoLiveChange, isPM, reload }: {
  project: PmProject;
  tasks: PmTask[];
  onProjectChange: (p: PmProject) => void;
  onGoLiveChange: (d: string) => void;
  isPM: boolean;
  reload: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const done = tasks.filter(t => t.status === "complete" || t.status === "approved").length;
  const open = tasks.filter(t => t.status !== "complete" && t.status !== "approved").length;
  const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "complete" && t.status !== "approved").length;
  const inReview = tasks.filter(t => t.status === "in_review").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const goLiveDays = daysUntil(project.go_live_date);
  const kickoffDays = daysUntil(project.kickoff_date);
  const clientReviewDays = inReview > 0 ? 0 : null;

  const callouts: { tone: "warning" | "destructive" | "info"; icon: React.ReactNode; msg: React.ReactNode; href: string }[] = [];
  if (overdue > 0) {
    callouts.push({
      tone: "destructive", icon: <AlertTriangle className="h-4 w-4" />,
      msg: <><strong>{overdue}</strong> overdue {overdue === 1 ? "task" : "tasks"}</>,
      href: buildQueueLink({ chips: ["overdue"] }),
    });
  }
  if (goLiveDays !== null && goLiveDays >= 0 && goLiveDays <= 7) {
    callouts.push({
      tone: "warning", icon: <CalendarClock className="h-4 w-4" />,
      msg: <>Go-live in <strong>{goLiveDays}</strong> {goLiveDays === 1 ? "day" : "days"}</>,
      href: `/pm/projects/${project.id}`,
    });
  } else if (kickoffDays !== null && kickoffDays >= 0 && kickoffDays <= 7) {
    callouts.push({
      tone: "warning", icon: <CalendarClock className="h-4 w-4" />,
      msg: <>Kickoff in <strong>{kickoffDays}</strong> {kickoffDays === 1 ? "day" : "days"}</>,
      href: `/pm/projects/${project.id}`,
    });
  }
  if (inReview > 0) {
    callouts.push({
      tone: "info", icon: <MessageSquare className="h-4 w-4" />,
      msg: <>Waiting on client review · <strong>{inReview}</strong> {inReview === 1 ? "task" : "tasks"}</>,
      href: `/pm/projects/${project.id}`,
    });
  }
  if (!callouts.length) {
    callouts.push({
      tone: "info", icon: <MessageSquare className="h-4 w-4" />,
      msg: <>All clear — no urgent items.</>,
      href: `/pm/projects/${project.id}`,
    });
  }

  const toneBorder = (t: string) => t === "warning" ? "border-warning" : t === "destructive" ? "border-destructive" : "border-info";
  const toneText = (t: string) => t === "warning" ? "text-warning" : t === "destructive" ? "text-destructive" : "text-info";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
      {/* Left */}
      <div className="space-y-4">
        <Card className="bg-secondary">
          <CardContent className="p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Start Here</div>
            <div className="space-y-2">
              {callouts.slice(0, 3).map((c, i) => (
                <Link key={i} to={c.href}
                  className={`flex items-center gap-2.5 bg-background rounded px-3 py-2 border-l-[3px] ${toneBorder(c.tone)} hover:bg-background/80 transition`}>
                  <span className={toneText(c.tone)}>{c.icon}</span>
                  <span className="text-sm">{c.msg}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary">
          <CardContent className="p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Brief</div>
            <RichTextEditor
              value={project.description ?? ""}
              onChange={(html) => onProjectChange({ ...project, description: html })}
              onBlur={() => updateProject(project.id, { description: project.description ?? "" })}
              placeholder="Project brief…"
            />
          </CardContent>
        </Card>
      </div>

      {/* Right */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Progress" value={`${pct}%`} />
          <MiniMetric label="Open" value={open} />
          <MiniMetric label="Done" value={done} />
        </div>

        <Card className="bg-secondary">
          <CardContent className="p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Key Dates</div>
            <KeyDateRow label="Kickoff" value={project.kickoff_date} editable={isPM}
              onChange={async v => { await updateProject(project.id, { kickoff_date: v ?? null } as any); reload(); }} />
            <KeyDateRow label="Client Review" value={project.start_date} editable={isPM}
              warning={clientReviewDays !== null}
              onChange={async v => { await updateProject(project.id, { start_date: v ?? null }); reload(); }} />
            <KeyDateRow label="Go-Live" value={project.go_live_date} editable={isPM}
              onChange={v => onGoLiveChange(v ?? "")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="bg-secondary">
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold leading-tight mt-0.5">{value}</div>
      </CardContent>
    </Card>
  );
}

function KeyDateRow({ label, value, onChange, editable, warning }: {
  label: string; value: string | null; onChange: (v: string | null) => void; editable: boolean; warning?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${warning ? "text-warning" : ""}`}>
      <span>{label}</span>
      {editable ? (
        <DatePicker value={value} onChange={(v) => onChange(v ?? null)} className="w-36 h-8" />
      ) : (
        <span className="text-muted-foreground">{fmtDate(value) || "—"}</span>
      )}
    </div>
  );
}

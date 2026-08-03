import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/pm/StatusPill";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { fmtDate, localDateISO } from "@/lib/pm/format";
import { coerceTaskKind } from "@/lib/pm/taskKind";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import type { PmProject, PmTask } from "@/types/pm";
import { CalendarDays } from "lucide-react";

/** Monday of the week containing this local date key (YYYY-MM-DD). */
function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0 = Sun
  const back = dow === 0 ? 6 : dow - 1;
  dt.setDate(dt.getDate() - back);
  return localDateISO(dt);
}

function weeksBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
}

function relLabel(delta: number): string {
  if (delta === 0) return "Go-live week";
  const n = Math.abs(delta);
  const unit = n === 1 ? "week" : "weeks";
  return delta < 0 ? `T-${n} ${unit}` : `T+${n} ${unit}`;
}

interface Props {
  project: PmProject;
  tasks: PmTask[];
  onGoToOverview?: () => void;
}

export function ProjectTimelineTab({ project, tasks, onGoToOverview }: Props) {
  const drawer = useTaskDrawerLink();
  const goLive = (project as any).go_live_date as string | null;

  const { groups, undated } = useMemo(() => {
    const dated = tasks.filter(t => !!t.due_date);
    const undated = tasks.filter(t => !t.due_date);

    const byWeek = new Map<string, PmTask[]>();
    for (const t of dated) {
      const wk = weekStartKey(t.due_date as string);
      const arr = byWeek.get(wk) ?? [];
      arr.push(t);
      byWeek.set(wk, arr);
    }

    const goLiveWeek = goLive ? weekStartKey(goLive) : null;
    const groups = Array.from(byWeek.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([wk, items]) => ({
        week: wk,
        rel: goLiveWeek ? relLabel(weeksBetween(goLiveWeek, wk)) : null,
        isGoLive: goLiveWeek === wk,
        tasks: items.sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)),
      }));

    return { groups, undated };
  }, [tasks, goLive]);

  if (!goLive) {
    return (
      <Card className="bg-secondary">
        <CardContent className="p-8 text-center space-y-3">
          <CalendarDays className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Set a go-live date to use the timeline.</p>
          {onGoToOverview && (
            <Button size="sm" variant="outline" onClick={onGoToOverview}>Go to Overview</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!groups.length && !undated.length) {
    return (
      <Card className="bg-secondary">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No tasks on this project yet.
        </CardContent>
      </Card>
    );
  }

  const row = (t: PmTask) => (
    <button
      key={t.id}
      type="button"
      onClick={() => drawer.open(t.id)}
      className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-muted/60 transition"
    >
      <span className="text-xs text-muted-foreground tabular-nums w-[86px] shrink-0">
        {t.due_date ? fmtDate(t.due_date) : "—"}
      </span>
      <UserAvatar userId={t.assignee_id} size="xs" />
      <span className="flex-1 min-w-0 truncate text-sm">{t.title}</span>
      <StatusPill status={t.status} kind={coerceTaskKind((t.custom_fields as any)?.kind)} />
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Tasks with a due date, grouped by week relative to go-live ({fmtDate(goLive)}).
      </p>

      {groups.map(g => (
        <Card key={g.week} className={g.isGoLive ? "border-info" : undefined}>
          <CardContent className="p-3 space-y-1">
            <div className="flex items-baseline gap-2 px-1 pb-1">
              <span className={`text-sm font-semibold ${g.isGoLive ? "text-info" : ""}`}>
                {g.isGoLive ? "Go-live week" : `Week of ${fmtDate(g.week)}`}
              </span>
              {g.rel && !g.isGoLive && (
                <span className="text-xs text-muted-foreground">({g.rel})</span>
              )}
              {g.isGoLive && <span className="text-xs text-muted-foreground">({fmtDate(g.week)})</span>}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {g.tasks.length} task{g.tasks.length === 1 ? "" : "s"}
              </span>
            </div>
            {g.tasks.map(row)}
          </CardContent>
        </Card>
      ))}

      {undated.length > 0 && (
        <Card className="bg-secondary">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-baseline gap-2 px-1 pb-1">
              <span className="text-sm font-semibold">No date set</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {undated.length} task{undated.length === 1 ? "" : "s"}
              </span>
            </div>
            {undated.map(row)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

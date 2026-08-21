import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDur, type EnrichedEntry, buildWeekGrid, weekDays } from "@/lib/pm/time";
import { EntryPopover } from "./EntryPopover";
import { useActiveTimer } from "@/components/pm/timer/ActiveTimerProvider";

export function TimesheetGrid({
  weekStart,
  entries,
  onChange,
}: {
  weekStart: Date;
  entries: EnrichedEntry[];
  onChange?: () => void;
}) {
  const days = weekDays(weekStart);
  const { rows, dayTotals, total } = buildWeekGrid(entries, days);
  const today = new Date().toISOString().slice(0, 10);
  const { start, startActivity } = useActiveTimer();

  return (
    <Card className="overflow-hidden">
      <div className="touch-scroll-x">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground">
              <th className="text-left font-medium px-2 md:px-3 py-2 sticky left-0 bg-muted/40 z-10 min-w-[140px] md:min-w-[280px]">Task / Activity</th>
              {days.map((d, i) => {
                const dt = parseISO(d);
                const isToday = d === today;
                return (
                  <th key={d} className={cn("px-2 py-2 text-center font-medium min-w-[90px]", isToday && "bg-primary/5 text-primary")}>
                    <div className="text-[11px]">{format(dt, "EEE")}</div>
                    <div className="text-xs">{format(dt, "MMM d")}</div>
                    <div className="text-[11px] font-semibold text-foreground mt-0.5">{fmtDur(dayTotals[i])}</div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-medium min-w-[90px]">
                <div className="text-[11px]">Total</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">{fmtDur(total)}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className="px-3 py-10 text-center text-sm text-muted-foreground italic">
                  No time logged this week.
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.rowKey} className="border-t border-border hover:bg-muted/20">
                <td className="px-2 md:px-3 py-2 sticky left-0 bg-card z-10 min-w-[140px] md:min-w-[280px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => row.isActivity
                        ? startActivity(row.activityId!, row.taskTitle)
                        : start(row.taskId!, row.taskTitle)}
                      title="Start timer"
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </Button>
                    <div className="min-w-0">
                      {row.isActivity ? (
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3 w-3" style={row.activityColor ? { color: row.activityColor } : undefined} />
                          <span className="text-sm font-medium truncate">{row.taskTitle}</span>
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">Activity</span>
                        </div>
                      ) : (
                        <Link to={`/pm/tasks/${row.taskId}`} className="text-sm font-medium hover:underline truncate block">
                          {row.taskTitle}
                        </Link>
                      )}
                      <div className="text-[11px] text-muted-foreground truncate">
                        {row.isActivity ? (
                          row.clientName ? <span>{row.clientName}</span> : <span>Overhead</span>
                        ) : (
                          <>
                            {row.clientName && <><span>{row.clientName}</span><span className="mx-1">·</span></>}
                            <Link to={`/pm/projects/${row.projectId}`} className="hover:underline">{row.projectTitle}</Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {row.perDay.map((mins, i) => {
                  const dayEntries = row.entries.filter(e => e.logged_at.slice(0, 10) === days[i]);
                  const isToday = days[i] === today;
                  return (
                    <td key={i} className={cn("px-1 py-1 text-center", isToday && "bg-primary/5")}>
                      <EntryPopover
                        taskId={row.taskId}
                        activityId={row.activityId}
                        taskTitle={row.taskTitle}
                        dateISO={days[i]}
                        entries={dayEntries}
                        onChange={onChange}
                      >
                        <button
                          className={cn(
                            "w-full h-9 rounded text-sm tabular-nums hover:bg-muted transition",
                            mins ? "font-medium" : "text-muted-foreground"
                          )}
                        >
                          {mins ? fmtDur(mins) : "—"}
                        </button>
                      </EntryPopover>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtDur(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

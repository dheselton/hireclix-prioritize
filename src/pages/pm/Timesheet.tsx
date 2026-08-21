import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { addDays, fmtDur, localDateISO, startOfWeek, useEnrichedEntries } from "@/lib/pm/time";
import { WeekPaginator } from "@/components/pm/time/WeekPaginator";
import { TimesheetGrid } from "@/components/pm/time/TimesheetGrid";
import { TimeEntriesList } from "@/components/pm/time/TimeEntriesList";
import { ActivitiesStrip } from "@/components/pm/time/ActivitiesStrip";
import { PinnedTasksStrip } from "@/components/pm/time/PinnedTasksStrip";

const DAY_WARN_MIN = 24 * 60;
const WEEK_WARN_MIN = 80 * 60;

const ALL_USERS = "__all__";

export default function Timesheet() {
  const { user: me, role } = useCurrentUser();
  const allUsers = useMockUsers().filter(u => u.role !== "submitter");
  const [params, setParams] = useSearchParams();

  const isManager = role === "pm";
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [view, setView] = useState<"timesheet" | "entries">("timesheet");
  const [selectedUserId, setSelectedUserId] = useState<string>(me?.id ?? "");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [projectFilterLocal, setProjectFilterLocal] = useState<string>("");
  const taskFilter = params.get("task");
  const projectFilter = params.get("project") ?? projectFilterLocal;

  useEffect(() => {
    if (!selectedUserId && me?.id) setSelectedUserId(me.id);
  }, [me?.id, selectedUserId]);

  const from = localDateISO(weekStart);
  const to = localDateISO(addDays(weekStart, 6));

  const userIds = isManager && selectedUserId === ALL_USERS ? allUsers.map(u => u.id) : undefined;
  const userId = isManager && selectedUserId !== ALL_USERS ? selectedUserId : (isManager ? undefined : me?.id);

  const { entries, reload } = useEnrichedEntries(
    {
      userId,
      userIds,
      from,
      to,
      taskId: taskFilter ?? undefined,
      projectId: projectFilter || undefined,
    },
    [userId, userIds?.join(","), from, to, taskFilter, projectFilter]
  );

  // Filtered for entries-view by client / local project chip (when not already URL-filtered)
  const visibleEntries = useMemo(() => {
    let list = entries;
    if (clientFilter) list = list.filter(e => e.client_id === clientFilter);
    if (projectFilterLocal && !params.get("project")) {
      list = list.filter(e => e.project_id === projectFilterLocal);
    }
    return list;
  }, [entries, clientFilter, projectFilterLocal, params]);

  // Client summary tiles (from unfiltered-by-chip week entries still scoped by URL project/task)
  const byClient = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; mins: number }>();
    for (const e of entries) {
      const key = e.client_id ?? "—";
      const existing = map.get(key) ?? { id: e.client_id, name: e.client_name ?? "No client", mins: 0 };
      existing.mins += e.minutes;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.mins - a.mins);
  }, [entries]);

  const byProject = useMemo(() => {
    const map = new Map<string, { id: string; title: string; mins: number }>();
    for (const e of entries) {
      if (!e.project_id) continue;
      const existing = map.get(e.project_id) ?? {
        id: e.project_id,
        title: e.project_title || "Untitled project",
        mins: 0,
      };
      existing.mins += e.minutes;
      map.set(e.project_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.mins - a.mins);
  }, [entries]);

  const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
  const billableMins = entries.filter(e => e.billable).reduce((s, e) => s + e.minutes, 0);
  const overheadMins = entries.filter(e => e.is_activity).reduce((s, e) => s + e.minutes, 0);
  const avgDayMins = Math.round(totalMins / 7);

  // Per-day totals to detect >24h in a day
  const perDayMins = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const day = e.logged_at.slice(0, 10);
      m.set(day, (m.get(day) ?? 0) + e.minutes);
    }
    return m;
  }, [entries]);
  const maxDayMins = Math.max(0, ...Array.from(perDayMins.values()));
  const anyDayHigh = maxDayMins > DAY_WARN_MIN;
  const weekHigh = totalMins > WEEK_WARN_MIN;
  const totalWarn = anyDayHigh || weekHigh;
  const billableWarn = billableMins > WEEK_WARN_MIN;
  const nonBillableWarn = (totalMins - billableMins) > WEEK_WARN_MIN;
  const avgWarn = avgDayMins > DAY_WARN_MIN;

  const activeProjectId = params.get("project") || projectFilterLocal;
  const activeProjectTitle =
    byProject.find((p) => p.id === activeProjectId)?.title ??
    entries.find((e) => e.project_id === activeProjectId)?.project_title ??
    null;

  function clearProjectFilter() {
    setProjectFilterLocal("");
    if (params.has("project")) {
      const next = new URLSearchParams(params);
      next.delete("project");
      setParams(next, { replace: true });
    }
  }

  function selectProject(id: string) {
    const active = activeProjectId === id;
    if (active) {
      clearProjectFilter();
      return;
    }
    setProjectFilterLocal(id);
    setClientFilter("");
    setView("entries");
    const next = new URLSearchParams(params);
    next.set("project", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="page-shell max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Time</h1>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <WeekPaginator weekStart={weekStart} onChange={setWeekStart} />

          {isManager && (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {me?.id && <SelectItem value={me.id}>Me ({me.name})</SelectItem>}
                <SelectItem value={ALL_USERS}>Whole team</SelectItem>
                <div className="border-t border-border my-1" />
                {allUsers.filter(u => u.id !== me?.id).map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Tabs value={view} onValueChange={(v) => setView(v as "timesheet" | "entries")}>
            <TabsList className="h-9">
              <TabsTrigger value="timesheet" className="text-xs">Timesheet</TabsTrigger>
              <TabsTrigger value="entries" className="text-xs">Time entries</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {taskFilter && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 bg-primary/10 rounded-md">
          <span>Showing entries for one task only.</span>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { params.delete("task"); setParams(params, { replace: true }); }}>
            Clear filter
          </Button>
        </div>
      )}

      {params.get("project") && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 bg-primary/10 rounded-md flex-wrap">
          <span>
            Showing this week&apos;s entries for project
            {activeProjectTitle ? <> <strong>{activeProjectTitle}</strong></> : null}.
            {" "}Overview shows all-time; this view is date-scoped.
          </span>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={clearProjectFilter}>
            Clear filter
          </Button>
        </div>
      )}

      <PinnedTasksStrip onLogged={reload} />
      <ActivitiesStrip onLogged={reload} />

      {/* Summary tiles */}
      <TooltipProvider>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryTile label="Total" value={fmtDur(totalMins)} warn={totalWarn} />
          <SummaryTile label="Billable" value={fmtDur(billableMins)} accent warn={billableWarn} />
          <SummaryTile label="Non-billable" value={fmtDur(totalMins - billableMins)} muted warn={nonBillableWarn} />
          <SummaryTile label="Overhead" value={fmtDur(overheadMins)} muted />
          <SummaryTile label="Avg / day" value={fmtDur(avgDayMins)} warn={avgWarn} />
        </div>
      </TooltipProvider>

      {/* By client */}
      {byClient.length > 0 && (
        <Card className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium uppercase tracking-wide mr-1">By client</span>
            {byClient.map(c => {
              const active = clientFilter === c.id;
              return (
                <button
                  key={c.id ?? "none"}
                  onClick={() => { setClientFilter(active ? "" : (c.id ?? "")); setView("entries"); }}
                  className={
                    "px-2 py-1 rounded-full border text-xs transition " +
                    (active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")
                  }
                >
                  {c.name} <span className="font-mono tabular-nums ml-1 opacity-80">{fmtDur(c.mins)}</span>
                </button>
              );
            })}
            {clientFilter && (
              <button onClick={() => setClientFilter("")} className="text-xs text-muted-foreground hover:underline ml-1">
                Clear
              </button>
            )}
          </div>
        </Card>
      )}

      {/* By project */}
      {byProject.length > 0 && !params.get("project") && (
        <Card className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium uppercase tracking-wide mr-1">By project</span>
            {byProject.map(p => {
              const active = activeProjectId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p.id)}
                  className={
                    "px-2 py-1 rounded-full border text-xs transition " +
                    (active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")
                  }
                >
                  {p.title} <span className="font-mono tabular-nums ml-1 opacity-80">{fmtDur(p.mins)}</span>
                </button>
              );
            })}
            {projectFilterLocal && (
              <button onClick={clearProjectFilter} className="text-xs text-muted-foreground hover:underline ml-1">
                Clear
              </button>
            )}
          </div>
        </Card>
      )}

      {view === "timesheet" ? (
        <TimesheetGrid weekStart={weekStart} entries={visibleEntries} onChange={reload} />
      ) : (
        <TimeEntriesList entries={visibleEntries} onChange={reload} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent, muted, warn }: { label: string; value: string; accent?: boolean; muted?: boolean; warn?: boolean }) {
  const valueClass = warn
    ? "text-amber-600 dark:text-amber-400"
    : accent ? "text-primary"
    : muted ? "text-muted-foreground"
    : "";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-xl font-bold mt-0.5 inline-flex items-center gap-1.5 " + valueClass}>
        {value}
        {warn && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex"><AlertTriangle className="h-4 w-4" /></span>
            </TooltipTrigger>
            <TooltipContent>This total seems high — check for a running timer or duplicate entries</TooltipContent>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { addDays, fmtDur, localDateISO, startOfWeek, useEnrichedEntries, weekDays } from "@/lib/pm/time";
import { WeekPaginator } from "@/components/pm/time/WeekPaginator";
import { TimesheetGrid } from "@/components/pm/time/TimesheetGrid";
import { TimeEntriesList } from "@/components/pm/time/TimeEntriesList";

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
  const taskFilter = params.get("task");

  useEffect(() => {
    if (!selectedUserId && me?.id) setSelectedUserId(me.id);
  }, [me?.id, selectedUserId]);

  const from = localDateISO(weekStart);
  const to = localDateISO(addDays(weekStart, 6));

  const userIds = isManager && selectedUserId === ALL_USERS ? allUsers.map(u => u.id) : undefined;
  const userId = isManager && selectedUserId !== ALL_USERS ? selectedUserId : (isManager ? undefined : me?.id);

  const { entries, reload } = useEnrichedEntries(
    { userId, userIds, from, to, taskId: taskFilter ?? undefined },
    [userId, userIds?.join(","), from, to, taskFilter]
  );

  // Filtered for entries-view by client
  const visibleEntries = useMemo(() => {
    if (!clientFilter) return entries;
    return entries.filter(e => e.client_id === clientFilter);
  }, [entries, clientFilter]);

  // Client summary tiles
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

  const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
  const billableMins = entries.filter(e => e.billable).reduce((s, e) => s + e.minutes, 0);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Time</h1>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <WeekPaginator weekStart={weekStart} onChange={setWeekStart} />

          {isManager && (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value={me?.id ?? ""}>Me ({me?.name})</SelectItem>
                <SelectItem value={ALL_USERS}>Whole team</SelectItem>
                <div className="border-t border-border my-1" />
                {allUsers.filter(u => u.id !== me?.id).map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
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

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Total" value={fmtDur(totalMins)} />
        <SummaryTile label="Billable" value={fmtDur(billableMins)} accent />
        <SummaryTile label="Non-billable" value={fmtDur(totalMins - billableMins)} muted />
        <SummaryTile label="Avg / day" value={fmtDur(Math.round(totalMins / 7))} />
      </div>

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

      {view === "timesheet" ? (
        <TimesheetGrid weekStart={weekStart} entries={visibleEntries} onChange={reload} />
      ) : (
        <TimeEntriesList entries={visibleEntries} onChange={reload} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={
        "text-xl font-bold mt-0.5 " +
        (accent ? "text-primary" : muted ? "text-muted-foreground" : "")
      }>{value}</div>
    </Card>
  );
}

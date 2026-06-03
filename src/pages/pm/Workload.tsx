import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmTask, PmProject } from "@/types/pm";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { StatusPill } from "@/components/pm/StatusPill";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/pm/format";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { applyTaskChips, applyTaskTypes } from "@/lib/pm/filters";
import { useTaskAssigneesMap } from "@/lib/pm/assignees";
import { useTypeFilter } from "@/hooks/useTypeFilter";

export default function Workload() {
  const users = useMockUsers().filter(u => u.role !== "submitter");
  const { user: me } = useCurrentUser();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const drawer = useTaskDrawerLink();
  const [mode, setMode] = useViewMode("workload", "list");
  const { isMe } = useMeMode();
  const chips = useChipFilters("workload");
  const { types } = useTypeFilter("workload");
  const typesKey = useMemo(() => [...types].sort().join(","), [types]);

  const reloadAll = () => {
    fetchTasks(undefined, { types: [...types] }).then(setTasks);
    fetchProjects().then(setProjects);
  };
  useEffect(() => { reloadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [typesKey]);
  useTasksChanged(reloadAll);
  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const trackedTasks = useMemo(() => applyTaskTypes(tasks, types), [tasks, types]);

  const today = new Date(); const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <CollectionToolbar
        title="Team Workload"
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        chipState={chips}
        typeFilterPage="workload"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => {
          const isMyRow = u.id === me?.id;
          const dimmed = isMe && !isMyRow;
          const activeRaw = trackedTasks.filter(t => t.assignee_id === u.id && t.status !== "complete" && t.status !== "approved");
          const active = applyTaskChips(activeRaw, chips.active, me?.id);
          const thisWeek = active.filter(t => t.due_date && new Date(t.due_date) <= weekEnd);
          const cap = u.capacity_hours_per_week / 8;
          const ratio = thisWeek.length / Math.max(1, cap);
          const tone = ratio < 0.7 ? "bg-emerald-500" : ratio < 1.05 ? "bg-amber-500" : "bg-red-500";
          return (
            <Card key={u.id} className={cn(
              "transition",
              isMyRow && isMe && "ring-2 ring-primary",
              dimmed && "opacity-50",
            )}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar userId={u.id} size="md" />
                  <div>
                    <div className="font-semibold">{u.name}{isMyRow && <span className="ml-1.5 text-[10px] uppercase text-primary">you</span>}</div>
                    <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>This week</span><span>{thisWeek.length} / {Math.round(cap)}</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full", tone)} style={{ width: `${Math.min(100, ratio*100)}%` }} />
                  </div>
                </div>
                {mode === "list" ? (
                  <div className="space-y-1 max-h-56 overflow-auto">
                    {active.slice(0, 8).map(t => (
                      <div key={t.id} className="text-xs p-2 rounded bg-muted/30 hover:bg-muted/60 cursor-pointer flex items-center justify-between gap-2"
                        onClick={() => drawer.open(t.id)}>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.title}</div>
                          <div className="text-muted-foreground truncate">{projById.get(t.project_id)?.title} · {fmtDate(t.due_date)}</div>
                        </div>
                        <StatusPill status={t.status} />
                      </div>
                    ))}
                    {!active.length && <div className="text-xs italic text-muted-foreground">No active tasks</div>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-72 overflow-auto">
                    {active.slice(0, 8).map(t => (
                      <div key={t.id} className="rounded-md border border-border p-2 hover:bg-muted/40 cursor-pointer space-y-1"
                        onClick={() => drawer.open(t.id)}>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px]">{t.type}</Badge>
                          <Badge variant="outline" className="text-[9px]">{t.priority}</Badge>
                        </div>
                        <div className="text-xs font-medium leading-tight">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{projById.get(t.project_id)?.title}</div>
                        <div className="flex items-center justify-between pt-1">
                          <StatusPill status={t.status} />
                          <span className="text-[10px] text-muted-foreground">{fmtDate(t.due_date)}</span>
                        </div>
                      </div>
                    ))}
                    {!active.length && <div className="text-xs italic text-muted-foreground">No active tasks</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <TaskDrawer />
    </div>
  );
}

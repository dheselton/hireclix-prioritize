import { useMemo, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { MilestoneBadge } from "@/components/pm/MilestoneSelect";
import {
  UNSET_MILESTONE_KEY,
  UNSET_MILESTONE_LABEL,
  compareProjectsByMilestone,
  milestoneLabel,
  useMilestoneDefinitions,
} from "@/lib/pm/milestones";
import type { PmProject, PmTask } from "@/types/pm";

type SortKey = "title" | "type" | "status" | "milestone" | "go_live_date" | "progress";

interface Props {
  projects: PmProject[];
  tasks: PmTask[];
  /** When set, only show projects whose milestone key is in the set (`__unset__` = null). */
  milestoneFilter?: string[];
  groupByMilestone?: boolean;
  onGroupByMilestoneChange?: (v: boolean) => void;
}

export function ProjectListView({
  projects,
  tasks,
  milestoneFilter,
  groupByMilestone = false,
  onGroupByMilestoneChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("go_live_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { data: defs = [] } = useMilestoneDefinitions({ includeInactive: true });

  const filtered = useMemo(() => {
    if (!milestoneFilter?.length) return projects;
    const set = new Set(milestoneFilter);
    return projects.filter((p) => {
      if (!p.milestone) return set.has(UNSET_MILESTONE_KEY);
      return set.has(p.milestone);
    });
  }, [projects, milestoneFilter]);

  const enriched = useMemo(() => filtered.map(p => {
    const projTasks = tasks.filter(t => t.project_id === p.id);
    const done = projTasks.filter(t => t.status === "complete" || t.status === "approved").length;
    const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
    return { p, pct };
  }), [filtered, tasks]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.p.title.localeCompare(b.p.title);
          break;
        case "type":
          cmp = a.p.type.localeCompare(b.p.type);
          break;
        case "status":
          cmp = a.p.status.localeCompare(b.p.status);
          break;
        case "milestone":
          cmp = compareProjectsByMilestone(a.p, b.p, defs);
          break;
        case "go_live_date":
          cmp = (a.p.go_live_date ?? "9999").localeCompare(b.p.go_live_date ?? "9999");
          break;
        case "progress":
          cmp = a.pct - b.pct;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [enriched, sortKey, sortDir, defs]);

  const grouped = useMemo(() => {
    if (!groupByMilestone) return null;
    const order = [
      ...defs.map((d) => d.key),
      UNSET_MILESTONE_KEY,
    ];
    const map = new Map<string, typeof sorted>();
    for (const row of sorted) {
      const key = row.p.milestone ?? UNSET_MILESTONE_KEY;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return order
      .filter((k) => map.has(k))
      .map((k) => ({
        key: k,
        label: k === UNSET_MILESTONE_KEY ? UNSET_MILESTONE_LABEL : milestoneLabel(k, defs),
        rows: map.get(k)!,
      }));
  }, [groupByMilestone, sorted, defs]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="p-3 font-medium select-none cursor-pointer" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  function renderRows(rows: typeof sorted) {
    return rows.map(({ p, pct }) => (
      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
        <td className="p-3">
          <div className="flex items-center gap-2">
            <WorkTypeBadge workType={(p as any).work_type ?? "project"} />
            <Link to={`/pm/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
          </div>
        </td>
        <td className="p-3"><Badge variant="outline">{p.type}</Badge></td>
        <td className="p-3"><Badge variant="outline" className="capitalize">{p.status.replace(/_/g, " ")}</Badge></td>
        <td className="p-3"><MilestoneBadge milestone={p.milestone} /></td>
        <td className="p-3 text-muted-foreground">{fmtDate(p.go_live_date)}</td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 max-w-[140px] h-2 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full bg-primary")} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <div className="space-y-2">
      {onGroupByMilestoneChange && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={groupByMilestone ? "default" : "outline"}
            onClick={() => onGroupByMilestoneChange(!groupByMilestone)}
          >
            Group by Milestone
          </Button>
        </div>
      )}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border text-left">
            <tr>
              <SortHead k="title">Project</SortHead>
              <SortHead k="type">Type</SortHead>
              <SortHead k="status">Status</SortHead>
              <SortHead k="milestone">Milestone</SortHead>
              <SortHead k="go_live_date">Go-Live</SortHead>
              <SortHead k="progress">Progress</SortHead>
            </tr>
          </thead>
          <tbody>
            {grouped
              ? grouped.map((g) => (
                <Fragment key={`g-${g.key}`}>
                  <tr className="bg-muted/30">
                    <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label} ({g.rows.length})
                    </td>
                  </tr>
                  {renderRows(g.rows)}
                </Fragment>
              ))
              : renderRows(sorted)}
            {!sorted.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                  No projects yet. Start a Quick Request or Full Project to get going.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

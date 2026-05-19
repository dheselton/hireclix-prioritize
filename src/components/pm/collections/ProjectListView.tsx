import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown } from "lucide-react";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import type { PmProject, PmTask } from "@/types/pm";

type SortKey = "title" | "type" | "status" | "go_live_date" | "progress";

interface Props {
  projects: PmProject[];
  tasks: PmTask[];
}

export function ProjectListView({ projects, tasks }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("go_live_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const enriched = useMemo(() => projects.map(p => {
    const projTasks = tasks.filter(t => t.project_id === p.id);
    const done = projTasks.filter(t => t.status === "complete" || t.status === "approved").length;
    const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
    return { p, pct };
  }), [projects, tasks]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "title": av = a.p.title; bv = b.p.title; break;
        case "type": av = a.p.type; bv = b.p.type; break;
        case "status": av = a.p.status; bv = b.p.status; break;
        case "go_live_date": av = a.p.go_live_date ?? "9999"; bv = b.p.go_live_date ?? "9999"; break;
        case "progress": av = a.pct; bv = b.pct; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [enriched, sortKey, sortDir]);

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

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b border-border text-left">
          <tr>
            <SortHead k="title">Project</SortHead>
            <SortHead k="type">Type</SortHead>
            <SortHead k="status">Status</SortHead>
            <SortHead k="go_live_date">Go-Live</SortHead>
            <SortHead k="progress">Progress</SortHead>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ p, pct }) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <WorkTypeBadge workType={(p as any).work_type ?? "project"} />
                  <Link to={`/pm/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                </div>
              </td>
              <td className="p-3"><Badge variant="outline">{p.type}</Badge></td>
              <td className="p-3"><Badge variant="outline">{p.status}</Badge></td>
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
          ))}
          {!sorted.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">No projects yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

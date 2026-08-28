import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/pm/format";
import { useClientNamesMap } from "@/lib/pm/clients";
import { fetchLiveCareerSites, type LiveSiteSummary } from "@/lib/pm/liveSites";
import { supabase } from "@/integrations/supabase/client";
import { isDone, type TaskStatus } from "@/types/pm";
import { useTasksChanged } from "@/lib/pm/refresh";

type Row = LiveSiteSummary & {
  clientName: string | null;
  openRequestCount: number;
};

export default function LiveCareerSites() {
  const clientNames = useClientNamesMap();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const sites = await fetchLiveCareerSites();
      const ids = sites.map((s) => s.id);
      const openByParent = new Map<string, number>();
      if (ids.length) {
        const [{ data: children }, { data: tasks }] = await Promise.all([
          supabase
            .from("pm_projects")
            .select("id,parent_project_id,status")
            .in("parent_project_id", ids)
            .eq("work_type", "request"),
          supabase
            .from("pm_tasks")
            .select("project_id,status"),
        ]);
        const childIds = new Set(((children ?? []) as { id: string }[]).map((c) => c.id));
        const openTasksByProject = new Map<string, number>();
        for (const t of ((tasks ?? []) as { project_id: string; status: string }[])) {
          if (!childIds.has(t.project_id)) continue;
          if (isDone(t.status as TaskStatus)) continue;
          openTasksByProject.set(t.project_id, (openTasksByProject.get(t.project_id) ?? 0) + 1);
        }
        for (const c of ((children ?? []) as { id: string; parent_project_id: string | null; status: string }[])) {
          if (!c.parent_project_id) continue;
          if (c.status === "complete" || c.status === "archived") continue;
          const open = openTasksByProject.get(c.id) ?? 0;
          // Count the linked request itself if it still has open work, else at least count active request shells
          const add = open > 0 ? 1 : (c.status === "active" || c.status === "on_hold" || c.status === "in_review" || c.status === "draft" ? 1 : 0);
          if (add) openByParent.set(c.parent_project_id, (openByParent.get(c.parent_project_id) ?? 0) + add);
        }
      }
      setRows(sites.map((s) => ({
        ...s,
        clientName: s.client_id ? (clientNames.get(s.client_id) ?? null) : null,
        openRequestCount: openByParent.get(s.id) ?? 0,
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load live career sites");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientNames]);
  useTasksChanged(() => { void reload(); });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.title.toLowerCase().includes(s)
      || (r.clientName ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <div className="page-shell space-y-4 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-[20px] font-medium leading-tight flex items-center gap-2">
          <Headphones className="h-5 w-5 text-muted-foreground" />
          Live Career Sites
        </h1>
        <p className="text-sm text-muted-foreground">
          Career site projects in Support mode — the home for ongoing support requests after go-live.
        </p>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by site or client…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <Card className="p-6 space-y-2">
          <p className="text-sm font-medium">No live career sites yet</p>
          <p className="text-sm text-muted-foreground">
            After a career site goes live, open the project and choose <span className="font-medium text-foreground">Enter Support mode</span>.
            It will appear here, and Career Site Support requests can nest under it.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((row) => (
          <Link
            key={row.id}
            to={`/pm/projects/${row.id}`}
            className="block rounded-md border border-border bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-medium truncate">{row.title}</div>
                <div className="text-[12px] text-muted-foreground truncate">
                  {row.clientName ?? "No client"}
                  {row.go_live_date && <> · Go-live {fmtDate(row.go_live_date)}</>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Support
                </Badge>
                {row.openRequestCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded text-[11px] font-semibold tabular-nums bg-primary/10 text-primary">
                    {row.openRequestCount}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

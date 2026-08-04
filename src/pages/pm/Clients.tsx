import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CalendarClock, Search, Users, Link2 } from "lucide-react";
import { useClientsWithPortal } from "@/lib/pm/portalAccess";
import { clientWorkLink } from "@/lib/pm/links";
import { fmtDate, todayISO } from "@/lib/pm/format";
import { isDone, type TaskStatus } from "@/types/pm";

interface ClientRow {
  id: string;
  name: string;
  is_internal: boolean;
  archived_at: string | null;
  projectCount: number;
  activeCount: number;
  overdueCount: number;
  nextGoLive: string | null;
}

type SortId = "name" | "active" | "goLive";
type ScopeId = "all" | "clients" | "internal" | "archived";

const INACTIVE = new Set(["complete", "archived", "cancelled"]);

export default function Clients() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("active");
  const [scope, setScope] = useState<ScopeId>("all");
  const withPortal = useClientsWithPortal();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = todayISO();
      const [{ data: clients }, { data: projects }, { data: tasks }] = await Promise.all([
        supabase.from("clients").select("id,name,is_internal,archived_at").order("name"),
        supabase.from("pm_projects").select("id,client_id,status,go_live_date"),
        supabase.from("pm_tasks").select("project_id,status,due_date").lt("due_date", today),
      ]);
      if (cancelled) return;

      const projs = (projects ?? []) as { id: string; client_id: string | null; status: string; go_live_date: string | null }[];
      const clientOfProject = new Map(projs.map(p => [p.id, p.client_id]));

      const overdue = new Map<string, number>();
      for (const t of ((tasks ?? []) as { project_id: string; status: string; due_date: string | null }[])) {
        if (isDone(t.status as TaskStatus)) continue;
        const cid = clientOfProject.get(t.project_id);
        if (!cid) continue;
        overdue.set(cid, (overdue.get(cid) ?? 0) + 1);
      }

      const counts = new Map<string, { total: number; active: number; nextGoLive: string | null }>();
      for (const p of projs) {
        if (!p.client_id) continue;
        const c = counts.get(p.client_id) ?? { total: 0, active: 0, nextGoLive: null };
        c.total += 1;
        if (!INACTIVE.has(p.status)) {
          c.active += 1;
          if (p.go_live_date && p.go_live_date >= today && (!c.nextGoLive || p.go_live_date < c.nextGoLive)) {
            c.nextGoLive = p.go_live_date;
          }
        }
        counts.set(p.client_id, c);
      }

      setRows(((clients ?? []) as any[]).map(c => ({
        id: c.id,
        name: c.name,
        is_internal: !!c.is_internal,
        archived_at: c.archived_at ?? null,
        projectCount: counts.get(c.id)?.total ?? 0,
        activeCount: counts.get(c.id)?.active ?? 0,
        overdueCount: overdue.get(c.id) ?? 0,
        nextGoLive: counts.get(c.id)?.nextGoLive ?? null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows.filter(r => (scope === "archived" ? !!r.archived_at : !r.archived_at));
    if (scope === "internal") out = out.filter(r => r.is_internal);
    if (scope === "clients") out = out.filter(r => !r.is_internal);
    if (s) out = out.filter(r => r.name.toLowerCase().includes(s));
    return [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "active") return b.activeCount - a.activeCount || a.name.localeCompare(b.name);
      const av = a.nextGoLive ?? "9999-12-31";
      const bv = b.nextGoLive ?? "9999-12-31";
      return av.localeCompare(bv) || a.name.localeCompare(b.name);
    });
  }, [rows, q, sort, scope]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-[20px] font-medium leading-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Every client, their active work, and who has access to their portal.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search clients…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={scope} onValueChange={v => setScope(v as ScopeId)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active</SelectItem>
            <SelectItem value="clients">Clients only</SelectItem>
            <SelectItem value="internal">Internal only</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as SortId)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Most active</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="goLive">Next go-live</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading clients…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No clients match that search.</p>
      )}

      <div className="grid gap-2">
        {filtered.map(c => (
          <Card key={c.id} className="p-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link to={`/pm/clients/${c.id}`} className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{c.name}</span>
                {c.is_internal && <span className="internal-pill">Internal</span>}
                {c.archived_at && <Badge variant="outline" className="text-muted-foreground">Archived</Badge>}
                {withPortal.has(c.id) && (
                  <Badge variant="outline" className="gap-1 bg-info/15 text-info border-info/30">
                    <Link2 className="h-3 w-3" /> Portal
                  </Badge>
                )}
              </Link>

              <div className="flex items-center gap-2 shrink-0 flex-wrap text-xs">
                {c.nextGoLive && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> {fmtDate(c.nextGoLive)}
                  </span>
                )}
                {c.overdueCount > 0 && (
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-warning hover:text-warning">
                    <Link to={clientWorkLink(c.id, ["overdue"])}>
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" /> {c.overdueCount} overdue
                    </Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground">
                  <Link to={clientWorkLink(c.id)}>
                    <Users className="h-3.5 w-3.5 mr-1" />
                    {c.activeCount} active / {c.projectCount} total
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

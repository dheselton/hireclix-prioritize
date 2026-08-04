import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Users, Link2 } from "lucide-react";
import { useClientsWithPortal } from "@/lib/pm/portalAccess";

interface ClientRow {
  id: string;
  name: string;
  is_internal: boolean;
  projectCount: number;
  activeCount: number;
}

export default function Clients() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const withPortal = useClientsWithPortal();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: clients }, { data: projects }] = await Promise.all([
        supabase.from("clients").select("id,name,is_internal").order("name"),
        supabase.from("pm_projects").select("id,client_id,status"),
      ]);
      if (cancelled) return;
      const counts = new Map<string, { total: number; active: number }>();
      for (const p of ((projects ?? []) as { client_id: string | null; status: string }[])) {
        if (!p.client_id) continue;
        const c = counts.get(p.client_id) ?? { total: 0, active: 0 };
        c.total += 1;
        if (p.status !== "complete" && p.status !== "archived") c.active += 1;
        counts.set(p.client_id, c);
      }
      setRows(((clients ?? []) as any[]).map(c => ({
        id: c.id,
        name: c.name,
        is_internal: !!c.is_internal,
        projectCount: counts.get(c.id)?.total ?? 0,
        activeCount: counts.get(c.id)?.active ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => r.name.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-[20px] font-medium leading-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Every client, their active work, and who has access to their portal.
        </p>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search clients…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading clients…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No clients match that search.</p>
      )}

      <div className="grid gap-2">
        {filtered.map(c => (
          <Link key={c.id} to={`/pm/clients/${c.id}`}>
            <Card className="p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{c.name}</span>
                {c.is_internal && <span className="internal-pill">Internal</span>}
                {withPortal.has(c.id) && (
                  <Badge variant="outline" className="gap-1 bg-info/15 text-info border-info/30">
                    <Link2 className="h-3 w-3" /> Portal
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {c.activeCount} active / {c.projectCount} total
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

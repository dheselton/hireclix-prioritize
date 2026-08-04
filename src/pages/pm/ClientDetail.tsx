import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalAccessPanel } from "@/components/pm/portal/PortalAccessPanel";
import { fmtDate } from "@/lib/pm/format";

interface ProjectRow { id: string; title: string; status: string; go_live_date: string | null; work_type: string | null }

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("clients").select("name,is_internal").eq("id", id).maybeSingle(),
        supabase.from("pm_projects").select("id,title,status,go_live_date,work_type")
          .eq("client_id", id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setName((c as any)?.name ?? "Client");
      setIsInternal(!!(c as any)?.is_internal);
      setProjects((p ?? []) as ProjectRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!id) return null;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <nav className="text-xs text-muted-foreground">
        <Link to="/pm/clients" className="hover:text-foreground">Clients</Link>
        <span className="mx-1">/</span><span>{name}</span>
      </nav>

      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-[20px] font-medium leading-tight">{name}</h1>
        {isInternal && <span className="internal-pill">Internal · HireClix</span>}
      </div>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="pt-3 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading projects…</p>}
          {!loading && projects.length === 0 && (
            <p className="text-sm text-muted-foreground">No projects for this client yet.</p>
          )}
          {projects.map(p => (
            <Link key={p.id} to={`/pm/projects/${p.id}`}>
              <Card className="p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{p.title}</span>
                  <Badge variant="outline" className="capitalize">{p.status.replace(/_/g, " ")}</Badge>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {p.go_live_date ? `Go-live ${fmtDate(p.go_live_date)}` : "No go-live date"}
                </span>
              </Card>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="portal" className="pt-3">
          <PortalAccessPanel clientId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

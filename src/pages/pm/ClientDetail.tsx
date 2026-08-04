import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ArchiveRestore, Link2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PortalAccessPanel } from "@/components/pm/portal/PortalAccessPanel";
import { ClientOverviewTab } from "@/components/pm/client/ClientOverviewTab";
import { ClientNotesTab } from "@/components/pm/client/ClientNotesTab";
import { ClientAssetsTab } from "@/components/pm/client/ClientAssetsTab";
import { EditClientDialog } from "@/components/pm/client/EditClientDialog";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { archiveClient, useClientHub, useClientRecord } from "@/lib/pm/clientHub";
import { useClientsWithPortal } from "@/lib/pm/portalAccess";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { canSee } from "@/lib/pm/permissions";
import { fmtDate } from "@/lib/pm/format";

const TABS = ["overview", "projects", "notes", "assets", "portal"] as const;
type TabId = (typeof TABS)[number];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { client, loading: clientLoading, reload: reloadClient } = useClientRecord(id);
  const { projects, stats, contacts, loading, error } = useClientHub(id);
  const withPortal = useClientsWithPortal();
  const { roles } = useCurrentUser();
  const canManage = canSee(roles, "clients");

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const raw = params.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(raw ?? "") ? (raw as TabId) : "overview";

  useEffect(() => {
    if (raw && !(TABS as readonly string[]).includes(raw)) {
      setParams(p => { p.set("tab", "overview"); return p; }, { replace: true });
    }
  }, [raw, setParams]);

  const setTab = (next: string) =>
    setParams(p => { p.set("tab", next); return p; }, { replace: true });

  const visibleProjects = useMemo(
    () => showAll ? projects : projects.filter(p => !["complete", "archived", "cancelled"].includes(p.status)),
    [projects, showAll],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleProjects>();
    for (const p of visibleProjects) {
      const key = p.work_type ?? "Other work";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.entries());
  }, [visibleProjects]);

  if (!id) return null;

  const archived = !!client?.archived_at;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <nav className="text-xs text-muted-foreground">
        <Link to="/pm/clients" className="hover:text-foreground">Clients</Link>
        <span className="mx-1">/</span><span>{client?.name ?? "Client"}</span>
      </nav>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[20px] font-medium leading-tight">
              {clientLoading ? "Loading…" : client?.name ?? "Client"}
            </h1>
            {client?.is_internal && <span className="internal-pill">Internal · HireClix</span>}
            {withPortal.has(id) && (
              <Badge variant="outline" className="gap-1 bg-info/15 text-info border-info/30">
                <Link2 className="h-3 w-3" /> Portal active
              </Badge>
            )}
            {archived && <Badge variant="outline" className="text-muted-foreground">Archived</Badge>}
          </div>
          {client?.notes && <p className="mt-1 text-sm text-muted-foreground">{client.notes}</p>}
        </div>

        {canManage && client && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="More client actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  {archived
                    ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Restore client</>
                    : <><Archive className="h-4 w-4 mr-2" /> Archive client</>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-3">
          <ClientOverviewTab
            clientId={id}
            stats={stats}
            projects={projects}
            contacts={contacts}
            loading={loading}
            error={error}
            onOpenPortal={() => setTab("portal")}
          />
        </TabsContent>

        <TabsContent value="projects" className="pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {showAll ? "All projects" : "Active projects"} for this client.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setShowAll(v => !v)}>
              {showAll ? "Active only" : "Show all"}
            </Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading projects…</p>}
          {!loading && visibleProjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {showAll ? "No projects for this client yet." : "No active projects — switch to “Show all”."}
            </p>
          )}

          {grouped.map(([group, rows]) => (
            <section key={group} className="space-y-2">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground capitalize">
                {group.replace(/_/g, " ")}
              </h2>
              {rows.map(p => (
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
            </section>
          ))}
        </TabsContent>

        <TabsContent value="notes" className="pt-3">
          <ClientNotesTab clientId={id} />
        </TabsContent>

        <TabsContent value="assets" className="pt-3">
          <ClientAssetsTab clientId={id} />
        </TabsContent>

        <TabsContent value="portal" className="pt-3">
          <PortalAccessPanel clientId={id} />
        </TabsContent>
      </Tabs>

      {client && (
        <EditClientDialog open={editOpen} onOpenChange={setEditOpen} client={client} onSaved={reloadClient} />
      )}

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        destructive={!archived}
        title={archived ? "Restore this client?" : "Archive this client?"}
        description={
          archived
            ? "The client reappears in the default clients list."
            : (stats?.activeProjects ?? 0) > 0
              ? `This client still has ${stats?.activeProjects} active project(s). Archiving hides them from the default list but does not touch their work.`
              : "Archiving hides the client from the default list. Nothing is deleted and you can restore them anytime."
        }
        confirmLabel={archived ? "Restore client" : "Archive client"}
        onConfirm={async () => {
          try {
            await archiveClient(id, !archived);
            await reloadClient();
            toast.success(archived ? "Client restored" : "Client archived");
          } catch (e: any) {
            toast.error(`Couldn't update client: ${e.message ?? e}`);
          }
        }}
      />
    </div>
  );
}

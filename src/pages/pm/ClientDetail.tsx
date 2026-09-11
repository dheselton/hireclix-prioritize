import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, Archive, ArchiveRestore, CalendarClock, CheckCircle2, Link2, MoreHorizontal, Pencil, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { PortalAccessPanel } from "@/components/pm/portal/PortalAccessPanel";
import { ClientOverviewTab } from "@/components/pm/client/ClientOverviewTab";
import { ClientNotesTab } from "@/components/pm/client/ClientNotesTab";
import { ClientAssetsTab } from "@/components/pm/client/ClientAssetsTab";
import { EditClientDialog } from "@/components/pm/client/EditClientDialog";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { useCreateWork } from "@/components/pm/CreateWorkProvider";
import { archiveClient, useClientFamily, useClientHub, useClientRecord } from "@/lib/pm/clientHub";
import { useClientsWithPortal } from "@/lib/pm/portalAccess";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { canCreateWork, canManageClientWork } from "@/lib/pm/permissions";
import { fmtDate } from "@/lib/pm/format";
import { useClientBrandMap } from "@/lib/pm/clients";
import { ClientLogo } from "@/components/pm/client/ClientLogo";
import { MilestoneBadge } from "@/components/pm/MilestoneSelect";

const TABS = ["overview", "projects", "requests", "timeline", "blocked", "completed", "notes", "assets", "portal"] as const;
type TabId = (typeof TABS)[number];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { client, loading: clientLoading, reload: reloadClient } = useClientRecord(id);
  const family = useClientFamily(id, client?.parent_client_id);
  const { projects, tasks, stats, contacts, loading, error, reload: reloadHub } = useClientHub(id);
  const withPortal = useClientsWithPortal();
  const brands = useClientBrandMap();
  const { roles, isAdmin } = useCurrentUser();
  const users = useMockUsers();
  const canCreate = canCreateWork(roles, { isAdmin });
  const canManage = canManageClientWork(roles, { isAdmin });
  const { openCreateWork } = useCreateWork();

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
    () => projects.filter((p) =>
      p.work_type !== "request"
      && (showAll || !["complete", "archived", "cancelled"].includes(p.status))),
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

  const activeProjects = useMemo(
    () => projects.filter((p) => p.work_type !== "request" && !["complete", "archived", "cancelled"].includes(p.status)),
    [projects],
  );
  const quickRequests = useMemo(
    () => projects.filter((p) => p.work_type === "request" && !["complete", "archived", "cancelled"].includes(p.status)),
    [projects],
  );
  const completed = useMemo(
    () => projects.filter((p) => ["complete", "archived", "cancelled"].includes(p.status)),
    [projects],
  );
  const blocked = useMemo(
    () => projects.filter((p) => p.status === "on_hold" || p.blocked_tasks > 0),
    [projects],
  );
  const timeline = useMemo(
    () => [...activeProjects].sort((a, b) =>
      (a.pp_go_live_date ?? a.go_live_date ?? a.next_due ?? "9999")
        .localeCompare(b.pp_go_live_date ?? b.go_live_date ?? b.next_due ?? "9999")),
    [activeProjects],
  );
  const namesById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  if (!id) return null;

  const archived = !!client?.archived_at;

  const openCreateForClient = (step: "request" | "project") => {
    openCreateWork(step, { clientId: id, onCreated: () => { void reloadHub(); } });
  };

  return (
    <div className="page-shell space-y-4 max-w-4xl">
      <nav className="text-xs text-muted-foreground">
        <Link to="/pm/clients" className="hover:text-foreground">Clients</Link>
        <span className="mx-1">/</span><span>{client?.name ?? "Client"}</span>
      </nav>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {client && (
              <ClientLogo
                name={client.name}
                logoUrl={brands.get(client.id)?.logoUrl ?? null}
                size="lg"
              />
            )}
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
          {(family.parent || family.children.length > 0 || family.aliases.length > 0) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {family.parent && (
                <span>Parent: <Link className="text-primary hover:underline" to={`/pm/clients/${family.parent.id}`}>{family.parent.name}</Link></span>
              )}
              {family.children.map((child) => (
                <Link key={child.id} className="rounded border px-1.5 py-0.5 hover:text-foreground" to={`/pm/clients/${child.id}`}>
                  {child.name}
                </Link>
              ))}
              {family.aliases.length > 0 && <span>Aliases: {family.aliases.map((alias) => alias.alias).join(", ")}</span>}
            </div>
          )}
        </div>

        {(canCreate || canManage) && client && (
          <div className="flex items-center gap-2 flex-wrap">
            {canCreate && !archived && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openCreateForClient("request")}
                  title="Lightweight project (1–3 tasks)"
                >
                  <Zap className="h-4 w-4 mr-1" /> Quick Request
                </Button>
                <Button
                  size="sm"
                  onClick={() => openCreateForClient("project")}
                  title="Multi-phase project with timeline"
                >
                  <Plus className="h-4 w-4 mr-1" /> Project
                </Button>
              </>
            )}
            {canManage && <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>}
            {canManage && <DropdownMenu>
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
            </DropdownMenu>}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="tab-strip">
          <TabsList className="inline-flex w-max h-auto flex-nowrap justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects ({activeProjects.length})</TabsTrigger>
            <TabsTrigger value="requests">Quick Requests ({quickRequests.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="blocked">Blocked ({blocked.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="portal">Portal</TabsTrigger>
          </TabsList>
        </div>

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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {showAll ? "No projects for this client yet." : "No active projects — switch to “Show all”."}
              </p>
              {canCreate && !archived && projects.length === 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCreateForClient("request")}
                    title="Lightweight project (1–3 tasks)"
                  >
                    <Zap className="h-4 w-4 mr-1" /> Quick Request
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openCreateForClient("project")}
                    title="Multi-phase project with timeline"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Project
                  </Button>
                </div>
              )}
            </div>
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
                      {p.milestone && <MilestoneBadge milestone={p.milestone} />}
                      {p.owner_ids.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {p.owner_ids.map((ownerId) => namesById.get(ownerId) ?? "Unknown").join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 text-right">
                      <div>{p.go_live_date ? `Proposed ${fmtDate(p.go_live_date)}` : "No proposed date"}</div>
                      <div>{p.pp_go_live_date ? `PP ${fmtDate(p.pp_go_live_date)}` : "PP not scheduled"}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </section>
          ))}
        </TabsContent>

        <TabsContent value="requests" className="pt-3 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading Quick Requests…</p>}
          {!loading && quickRequests.length === 0 && (
            <p className="text-sm text-muted-foreground">No active Quick Requests for this client.</p>
          )}
          {quickRequests.map((request) => (
            <Link key={request.id} to={`/pm/projects/${request.id}`}>
              <Card className="p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{request.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {request.unclaimed_tasks > 0
                        ? `${request.unclaimed_tasks} unclaimed`
                        : request.open_tasks > 0 ? `${request.open_tasks} in progress` : "No open tasks"}
                      {request.owner_ids.length
                        ? ` · ${request.owner_ids.map((ownerId) => namesById.get(ownerId) ?? "Unknown").join(", ")}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {request.blocked_tasks > 0 && <Badge variant="destructive">Blocked</Badge>}
                    {request.overdue_tasks > 0 && <Badge variant="destructive">Overdue</Badge>}
                    <Badge variant="outline" className="capitalize">{request.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="pt-3 space-y-2">
          {!loading && timeline.length === 0 && (
            <p className="text-sm text-muted-foreground">No active project timeline yet.</p>
          )}
          {timeline.map((project) => (
            <Link key={project.id} to={`/pm/projects/${project.id}`}>
              <Card className="p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{project.title}</span>
                  <MilestoneBadge milestone={project.milestone} />
                </div>
                <div className="text-xs text-muted-foreground text-right shrink-0">
                  <div>Proposed: {project.go_live_date ? fmtDate(project.go_live_date) : "—"}</div>
                  <div>Dynamic PP: {project.pp_go_live_date ? fmtDate(project.pp_go_live_date) : "—"}</div>
                </div>
              </Card>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="blocked" className="pt-3 space-y-2">
          {!loading && blocked.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing is currently blocked or waiting.</p>
          )}
          {blocked.map((project) => {
            const blockedTasks = tasks.filter((task) => task.project_id === project.id && task.status === "blocked");
            return (
              <Card key={project.id} className="p-3">
                <Link to={`/pm/projects/${project.id}`} className="flex items-center gap-2 font-medium text-sm hover:text-primary">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {project.title}
                </Link>
                <div className="mt-2 space-y-1">
                  {project.status === "on_hold" && <p className="text-xs text-muted-foreground">Project is on hold.</p>}
                  {blockedTasks.map((task) => (
                    <Link key={task.id} to={`/pm/tasks/${task.id}`} className="block text-xs text-muted-foreground hover:text-foreground">
                      {task.title}{task.dev_blocker ? ` — ${task.dev_blocker}` : ""}
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="completed" className="pt-3 space-y-2">
          {!loading && completed.length === 0 && (
            <p className="text-sm text-muted-foreground">No completed work yet.</p>
          )}
          {completed.map((project) => (
            <Link key={project.id} to={`/pm/projects/${project.id}`}>
              <Card className="p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{project.title}</span>
                  <Badge variant="outline">{project.work_type === "request" ? "Quick Request" : "Project"}</Badge>
                </div>
                <Badge variant="outline" className="capitalize">{project.status.replace(/_/g, " ")}</Badge>
              </Card>
            </Link>
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
        <EditClientDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          client={client}
          onSaved={() => { void reloadClient(); void family.reload(); }}
        />
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

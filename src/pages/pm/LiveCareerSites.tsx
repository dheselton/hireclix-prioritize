import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Headphones, Search, LifeBuoy, AlertTriangle, Clock, Link2, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtDateShort } from "@/lib/pm/format";
import { useClientBrandMap } from "@/lib/pm/clients";
import {
  fetchLiveCareerSites,
  linkRequestToLiveSite,
  liveSitesForClient,
  type LiveSiteSummary,
} from "@/lib/pm/liveSites";
import {
  fetchSiteQueueSummaries,
  fetchUnlinkedCareerSiteRequests,
  type SiteQueueSummary,
} from "@/lib/pm/supportQueue";
import {
  createLiveSiteFromOps,
  createLiveSitesFromOps,
  fetchOpsSites,
  fetchUnmappedOpsSites,
  healthBadgeClass,
  linkOpsSiteToProject,
  opsSiteByProjectId,
  triggerOpsSitesSync,
  type PmOpsSite,
} from "@/lib/pm/opsSites";
import { requestTypeLabel } from "@/lib/pm/requestTypes";
import { useTasksChanged } from "@/lib/pm/refresh";
import { ClientLogo } from "@/components/pm/client/ClientLogo";
import { AvatarStack } from "@/components/pm/AvatarStack";
import { LogSupportRequestDialog } from "@/components/pm/project/LogSupportRequestDialog";
import { cn } from "@/lib/utils";
import type { PmProject } from "@/types/pm";
import { toast } from "sonner";

type SortKey = "open" | "oldest" | "client";

type Row = LiveSiteSummary & {
  clientName: string | null;
  logoUrl: string | null;
  queue: SiteQueueSummary;
};

function liveSinceLabel(project: LiveSiteSummary): string | null {
  const at = (project.custom_fields as { support_mode_at?: string } | null)?.support_mode_at;
  if (!at) return null;
  try {
    return fmtDate(at.slice(0, 10));
  } catch {
    return null;
  }
}

function ageLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}

export default function LiveCareerSites() {
  const brands = useClientBrandMap();
  const [rows, setRows] = useState<Row[]>([]);
  const [unlinked, setUnlinked] = useState<PmProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("open");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyUnclaimed, setOnlyUnclaimed] = useState(false);
  const [logFor, setLogFor] = useState<LiveSiteSummary | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [opsByProject, setOpsByProject] = useState<Map<string, PmOpsSite>>(new Map());
  const [unmappedOps, setUnmappedOps] = useState<PmOpsSite[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [mapBusyId, setMapBusyId] = useState<string | null>(null);
  const [createBusyId, setCreateBusyId] = useState<string | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const sites = await fetchLiveCareerSites();
      const summaries = await fetchSiteQueueSummaries(sites.map((s) => s.id));
      const orphaned = await fetchUnlinkedCareerSiteRequests();
      setRows(
        sites.map((s) => {
          const brand = s.client_id ? brands.get(s.client_id) : undefined;
          return {
            ...s,
            clientName: brand?.name ?? null,
            logoUrl: brand?.logoUrl ?? null,
            queue:
              summaries.get(s.id) ??
              ({
                parentProjectId: s.id,
                openRequestCount: 0,
                needsTriage: 0,
                inProgress: 0,
                awaitingVendor: 0,
                waiting: 0,
                overdue: 0,
                closedLast30d: 0,
                oldestOpenAgeDays: null,
                nextDue: null,
                assigneeIds: [],
              } satisfies SiteQueueSummary),
          };
        }),
      );
      setUnlinked(orphaned);
      try {
        const ops = await fetchOpsSites();
        setOpsByProject(opsSiteByProjectId(ops));
        setUnmappedOps(await fetchUnmappedOpsSites());
      } catch {
        setOpsByProject(new Map());
        setUnmappedOps([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load live career sites");
      setRows([]);
      setUnlinked([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands]);
  useTasksChanged(() => {
    void reload();
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (onlyOverdue && r.queue.overdue === 0) return false;
      if (onlyUnclaimed && r.queue.needsTriage === 0) return false;
      if (!s) return true;
      return (
        r.title.toLowerCase().includes(s) ||
        (r.clientName ?? "").toLowerCase().includes(s)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "open") {
        const diff = b.queue.openRequestCount - a.queue.openRequestCount;
        if (diff !== 0) return diff;
        return (a.clientName ?? a.title).localeCompare(b.clientName ?? b.title);
      }
      if (sort === "oldest") {
        const ao = a.queue.oldestOpenAgeDays ?? -1;
        const bo = b.queue.oldestOpenAgeDays ?? -1;
        return bo - ao;
      }
      return (a.clientName ?? a.title).localeCompare(b.clientName ?? b.title);
    });
    return list;
  }, [rows, q, sort, onlyOverdue, onlyUnclaimed]);

  async function linkOrphan(request: PmProject, parentId: string) {
    setLinkBusyId(request.id);
    try {
      await linkRequestToLiveSite(request.id, parentId);
      toast.success("Linked to live site");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't link request");
    } finally {
      setLinkBusyId(null);
    }
  }

  async function syncFromOps() {
    setSyncing(true);
    try {
      const result = await triggerOpsSitesSync();
      if (result.skipped) {
        toast.message(result.message ?? "Ops API URL not configured yet");
      } else {
        toast.success(
          `Synced ${result.synced} sites (${result.linked} linked, ${result.unmapped} need mapping)`,
        );
      }
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function mapOpsSite(opsSiteId: string, projectId: string) {
    setMapBusyId(opsSiteId);
    try {
      const site = rows.find((r) => r.id === projectId);
      await linkOpsSiteToProject(opsSiteId, projectId, site?.client_id ?? null);
      toast.success("Mapped to Prioritize project");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't map site");
    } finally {
      setMapBusyId(null);
    }
  }

  async function createFromOps(site: PmOpsSite) {
    setCreateBusyId(site.ops_site_id);
    try {
      await createLiveSiteFromOps(site);
      toast.success(`Created live site: ${site.name}`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't create live site");
    } finally {
      setCreateBusyId(null);
    }
  }

  async function createAllFromOps() {
    if (unmappedOps.length === 0) return;
    setCreatingAll(true);
    try {
      const result = await createLiveSitesFromOps(unmappedOps);
      if (result.failed === 0) {
        toast.success(`Created ${result.created} live sites`);
      } else {
        toast.message(
          `Created ${result.created} live sites (${result.failed} failed)`,
        );
      }
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Bulk create failed");
    } finally {
      setCreatingAll(false);
    }
  }

  return (
    <div className="page-shell space-y-5 max-w-6xl">
      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-medium leading-tight flex items-center gap-2">
              <Headphones className="h-5 w-5 text-muted-foreground" />
              Live Career Sites
            </h1>
            <p className="text-sm text-muted-foreground">
              Career site projects in Support mode — queue health from Prioritize, uptime from{" "}
              <a
                href="https://careersite-ops.hireclix.com/site-health"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                careersite-ops
              </a>
              .
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={syncing}
            onClick={() => void syncFromOps()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync from ops"}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by site or client…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Most open requests</SelectItem>
            <SelectItem value="oldest">Oldest open request</SelectItem>
            <SelectItem value="client">Client name</SelectItem>
          </SelectContent>
        </Select>
        <FilterToggle active={onlyUnclaimed} onClick={() => setOnlyUnclaimed((v) => !v)} label="Needs triage" />
        <FilterToggle active={onlyOverdue} onClick={() => setOnlyOverdue((v) => !v)} label="Has overdue" />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <Card className="p-6 space-y-2">
          <p className="text-sm font-medium">No live career sites yet</p>
          <p className="text-sm text-muted-foreground">
            After a career site goes live, open the project and choose{" "}
            <span className="font-medium text-foreground">Enter Support mode</span>. It will appear
            here, and Career Site Support requests can nest under it.
          </p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((row) => {
          const liveSince = liveSinceLabel(row);
          const ops = opsByProject.get(row.id);
          return (
            <Card
              key={row.id}
              className="overflow-hidden hover:border-primary/40 transition-colors flex flex-col"
            >
              <CardContent className="p-4 flex flex-col gap-3 flex-1">
                <Link
                  to={`/pm/projects/${row.id}?tab=support`}
                  className="flex items-start gap-3 min-w-0 group"
                >
                  <ClientLogo
                    name={row.clientName ?? row.title}
                    logoUrl={row.logoUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-[11px] text-muted-foreground truncate">
                      {row.clientName ?? "No client"}
                    </div>
                    <div className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {row.title}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {liveSince && <span>Live since {liveSince}</span>}
                      {row.go_live_date && (
                        <span>
                          {liveSince ? "· " : ""}Go-live {fmtDate(row.go_live_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      Support
                    </Badge>
                    {ops && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wide",
                          healthBadgeClass(ops.health_status),
                        )}
                        title={ops.prod_url ?? ops.name}
                      >
                        {ops.health_status}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric
                    label="Open"
                    value={row.queue.openRequestCount}
                    accent={row.queue.openRequestCount > 0 ? "text-foreground" : undefined}
                  />
                  <Metric
                    label="Triage"
                    value={row.queue.needsTriage}
                    accent={row.queue.needsTriage > 0 ? "text-primary" : undefined}
                  />
                  <Metric
                    label="Overdue"
                    value={row.queue.overdue}
                    accent={row.queue.overdue > 0 ? "text-destructive" : undefined}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {row.queue.inProgress > 0 && (
                    <span>{row.queue.inProgress} in progress</span>
                  )}
                  {row.queue.awaitingVendor > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      {row.queue.awaitingVendor} awaiting vendor
                    </span>
                  )}
                  {row.queue.waiting > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {row.queue.waiting} waiting
                    </span>
                  )}
                  {row.queue.oldestOpenAgeDays != null && row.queue.openRequestCount > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      Oldest {ageLabel(row.queue.oldestOpenAgeDays)}
                    </span>
                  )}
                  {row.queue.nextDue && (
                    <span>Next due {fmtDateShort(row.queue.nextDue)}</span>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <AvatarStack userIds={row.queue.assigneeIds} max={4} size="xs" />
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        setLogFor(row);
                      }}
                    >
                      <LifeBuoy className="h-3 w-3 mr-1" /> New request
                    </Button>
                    <Button size="sm" className="h-7 text-xs" asChild>
                      <Link to={`/pm/projects/${row.id}?tab=support`}>Open</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {unmappedOps.length > 0 && (
        <section className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-medium">Unmapped ops sites</h2>
            <Badge variant="secondary" className="tabular-nums">
              {unmappedOps.length}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs ml-auto"
              disabled={creatingAll || !!createBusyId || !!mapBusyId}
              onClick={() => void createAllFromOps()}
            >
              {creatingAll ? "Creating…" : "Create all unmapped"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            From careersite-ops but not linked yet. Create a Support-mode inventory record (not a
            new build) so down alerts and vendor escalations have a home — or map to an existing
            live site.
          </p>
          <ul className="space-y-2">
            {unmappedOps.map((site) => {
              const rowBusy =
                creatingAll ||
                createBusyId === site.ops_site_id ||
                mapBusyId === site.ops_site_id;
              return (
                <li
                  key={site.ops_site_id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{site.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {site.client_name ?? "No client"}
                      {site.prod_url ? ` · ${site.prod_url}` : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase tracking-wide",
                      healthBadgeClass(site.health_status),
                    )}
                  >
                    {site.health_status}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    disabled={rowBusy}
                    onClick={() => void createFromOps(site)}
                  >
                    {createBusyId === site.ops_site_id ? "Creating…" : "Create live site"}
                  </Button>
                  <Select
                    disabled={rowBusy || rows.length === 0}
                    onValueChange={(projectId) => void mapOpsSite(site.ops_site_id, projectId)}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue
                        placeholder={
                          mapBusyId === site.ops_site_id ? "Linking…" : "Map to Prioritize site"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover max-h-64">
                      {rows.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.clientName ? `${r.clientName} — ` : ""}
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unlinked.length > 0 && (
        <section className="space-y-2 pt-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Unlinked career site requests</h2>
            <Badge variant="secondary" className="tabular-nums">
              {unlinked.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Submitted before a live site existed for the client — link them so they appear in the
            site&apos;s Support queue.
          </p>
          <ul className="space-y-2">
            {unlinked.map((req) => (
              <UnlinkedRow
                key={req.id}
                request={req}
                clientName={req.client_id ? brands.get(req.client_id)?.name ?? null : null}
                busy={linkBusyId === req.id}
                onLink={(parentId) => void linkOrphan(req, parentId)}
              />
            ))}
          </ul>
        </section>
      )}

      {logFor && (
        <LogSupportRequestDialog
          open={!!logFor}
          onOpenChange={(o) => {
            if (!o) setLogFor(null);
          }}
          project={logFor}
          onCreated={() => {
            setLogFor(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className={cn("text-base font-semibold tabular-nums", accent ?? "text-muted-foreground")}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-3 rounded-full text-xs border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function UnlinkedRow({
  request,
  clientName,
  busy,
  onLink,
}: {
  request: PmProject;
  clientName: string | null;
  busy: boolean;
  onLink: (parentId: string) => void;
}) {
  const [sites, setSites] = useState<LiveSiteSummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const rt = (request.custom_fields as { request_type?: string } | null)?.request_type;

  useEffect(() => {
    if (!request.client_id) {
      setSites([]);
      return;
    }
    let cancelled = false;
    void liveSitesForClient(request.client_id).then((s) => {
      if (cancelled) return;
      setSites(s);
      if (s.length === 1) setSelected(s[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [request.client_id]);

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          to={`/pm/projects/${request.id}`}
          className="text-sm font-medium hover:text-primary truncate block"
        >
          {request.title}
        </Link>
        <div className="text-[11px] text-muted-foreground truncate">
          {clientName ?? "No client"}
          {rt ? ` · ${requestTypeLabel(rt) ?? rt}` : ""}
          {request.created_at ? ` · ${fmtDate(request.created_at.slice(0, 10))}` : ""}
        </div>
      </div>
      {sites.length === 0 ? (
        <span className="text-[11px] text-muted-foreground">No live site for this client yet</span>
      ) : (
        <>
          {sites.length > 1 && (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Select site…" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {sites.length === 1 && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
              → {sites[0].title}
            </span>
          )}
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={busy || !selected}
            onClick={() => onLink(selected)}
          >
            {busy ? "Linking…" : "Link"}
          </Button>
        </>
      )}
    </li>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LifeBuoy, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AvatarStack } from "@/components/pm/AvatarStack";
import { MeModeToggle } from "@/components/pm/MeModeToggle";
import { useMeMode } from "@/hooks/useMeMode";
import { fmtDate } from "@/lib/pm/format";
import { REQUEST_TYPE_GROUPS, requestTypeLabel } from "@/lib/pm/requestTypes";
import {
  fetchSupportQueueForSite,
  summarizeQueue,
  type SupportRequestRollup,
  type SupportRollupStatus,
} from "@/lib/pm/supportQueue";
import { useTasksChanged } from "@/lib/pm/refresh";
import { cn } from "@/lib/utils";
import type { PmTask } from "@/types/pm";
import { isDone, type TaskStatus } from "@/types/pm";

const CAREER_TYPES =
  REQUEST_TYPE_GROUPS.find((g) => g.key === "career_site")?.types ?? [];

const GROUP_ORDER: { status: SupportRollupStatus; label: string }[] = [
  { status: "needs_triage", label: "Needs triage" },
  { status: "in_progress", label: "In progress" },
  { status: "waiting", label: "Waiting" },
  { status: "closed", label: "Recently closed" },
];

function isSupportTask(t: PmTask): boolean {
  const tags = Array.isArray((t as { tags?: string[] }).tags)
    ? ((t as { tags: string[] }).tags)
    : [];
  if (tags.includes("support")) return true;
  const cf = (t as { custom_fields?: { is_support?: boolean } }).custom_fields;
  return !!cf?.is_support;
}

function ageLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

interface Props {
  projectId: string;
  siteTasks: PmTask[];
  meId: string | null;
  onLogRequest: () => void;
  onOpenLegacyTask?: (taskId: string) => void;
  onOpenCountChange?: (count: number) => void;
}

export function SupportTab({
  projectId,
  siteTasks,
  meId,
  onLogRequest,
  onOpenLegacyTask,
  onOpenCountChange,
}: Props) {
  const { mode } = useMeMode();
  const [rows, setRows] = useState<SupportRequestRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchSupportQueueForSite(projectId));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useTasksChanged(reload);

  const summary = useMemo(() => summarizeQueue(rows), [rows]);

  useEffect(() => {
    onOpenCountChange?.(summary.open);
  }, [summary.open, onOpenCountChange]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter && r.requestType !== typeFilter) return false;
      if (mode === "me" && meId) {
        const mine =
          r.assigneeIds.includes(meId) ||
          r.project.requested_by === meId ||
          r.project.created_by === meId;
        if (!mine) return false;
      }
      if (!s) return true;
      const label = requestTypeLabel(r.requestType) ?? "";
      return (
        r.project.title.toLowerCase().includes(s) ||
        label.toLowerCase().includes(s)
      );
    });
  }, [rows, q, typeFilter, mode, meId]);

  const legacySupportTasks = useMemo(
    () =>
      siteTasks.filter(
        (t) => isSupportTask(t) && !isDone(t.status as TaskStatus),
      ),
    [siteTasks],
  );

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.requestType || r.rollupStatus === "closed") continue;
      m.set(r.requestType, (m.get(r.requestType) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          <Stat label="Open" value={summary.open} />
          <Stat label="Needs triage" value={summary.unclaimed} accent="text-primary" />
          <Stat label="Overdue" value={summary.overdue} accent="text-destructive" />
          <Stat label="Waiting" value={summary.waiting} accent="text-warning" />
          <Stat label="Closed 30d" value={summary.closedLast30d} accent="text-muted-foreground" />
        </div>
        <Button size="sm" onClick={onLogRequest}>
          <LifeBuoy className="h-4 w-4 mr-1" /> New support request
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-8"
            placeholder="Search requests…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <MeModeToggle />
        <div className="flex flex-wrap gap-1.5">
          <TypeChip
            active={!typeFilter}
            label="All types"
            onClick={() => setTypeFilter(null)}
          />
          {CAREER_TYPES.map((t) => {
            const cnt = typeCounts.get(t);
            if (!cnt && typeFilter !== t) return null;
            return (
              <TypeChip
                key={t}
                active={typeFilter === t}
                label={`${requestTypeLabel(t) ?? t}${cnt ? ` (${cnt})` : ""}`}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              />
            );
          })}
        </div>
      </div>

      {loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading support queue…</p>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium">No support requests yet</p>
            <p className="text-sm text-muted-foreground">
              Career Site Support requests from the public form, Quick Request intake, or
              &ldquo;New support request&rdquo; land here.
            </p>
            <Button size="sm" variant="outline" onClick={onLogRequest}>
              <LifeBuoy className="h-4 w-4 mr-1" /> Log the first request
            </Button>
          </CardContent>
        </Card>
      )}

      {GROUP_ORDER.map(({ status, label }) => {
        const group = filtered.filter((r) => r.rollupStatus === status);
        // Only show recently closed (summarize already limited closedLast30d conceptually —
        // filter closed to last 30d for the group display).
        const visible =
          status === "closed"
            ? group.filter((r) => {
                const closedAt = r.project.updated_at ?? r.project.created_at;
                const cutoff = Date.now() - 30 * 86400000;
                return closedAt && new Date(closedAt).getTime() >= cutoff;
              })
            : group;
        if (!visible.length) return null;
        return (
          <section key={status} className="space-y-1.5">
            <div className="flex items-center gap-2 px-0.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </h3>
              <Badge variant="secondary" className="tabular-nums h-5 text-[10px]">
                {visible.length}
              </Badge>
            </div>
            <ul className="space-y-1">
              {visible.map((r) => (
                <li key={r.project.id}>
                  <Link
                    to={`/pm/projects/${r.project.id}`}
                    className={cn(
                      "flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 hover:bg-accent/30 transition-colors",
                      status === "closed" && "opacity-70",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{r.project.title}</span>
                        {r.requestType && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {requestTypeLabel(r.requestType) ?? r.requestType}
                          </Badge>
                        )}
                        {r.priority && r.priority !== "medium" && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize",
                              r.priority === "urgent" && "border-destructive/40 text-destructive",
                              r.priority === "high" && "border-warning/40 text-warning",
                            )}
                          >
                            {r.priority}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Age {ageLabel(r.oldestOpenAgeDays)}</span>
                        {r.nextDue && <span>Due {fmtDate(r.nextDue)}</span>}
                        {r.openTasks > 0 && (
                          <span>
                            {r.openTasks} open task{r.openTasks === 1 ? "" : "s"}
                            {r.unclaimedTasks > 0 ? ` · ${r.unclaimedTasks} unclaimed` : ""}
                          </span>
                        )}
                        {r.overdueTasks > 0 && (
                          <span className="text-destructive font-medium">
                            {r.overdueTasks} overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <AvatarStack userIds={r.assigneeIds} max={3} size="xs" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {legacySupportTasks.length > 0 && (
        <section className="space-y-1.5 pt-2 border-t border-border">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            onClick={() => setLegacyOpen((o) => !o)}
          >
            {legacyOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Logged directly on this site
            <Badge variant="secondary" className="tabular-nums h-5 text-[10px]">
              {legacySupportTasks.length}
            </Badge>
          </button>
          {legacyOpen && (
            <>
              <p className="text-[11px] text-muted-foreground px-0.5">
                Legacy support-tagged tasks created before requests were nested under this site.
              </p>
              <ul className="space-y-1 opacity-80">
                {legacySupportTasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="w-full text-left rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent/30"
                      onClick={() => onOpenLegacyTask?.(t.id)}
                    >
                      <span className="font-medium">{t.title}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground capitalize">
                        {t.status.replace(/_/g, " ")}
                        {t.due_date ? ` · Due ${fmtDate(t.due_date)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent)}>{value}</span>
    </div>
  );
}

function TypeChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-full text-[11px] border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

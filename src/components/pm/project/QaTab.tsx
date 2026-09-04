import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bug, CheckCircle2, ChevronDown, ChevronRight, ListPlus, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { fmtDate } from "@/lib/pm/format";
import { getTaskKind, getQaDetails, getKindStatusLabel, QA_SEVERITY_STYLE, QA_SEVERITIES, type QaSeverity } from "@/lib/pm/taskKind";
import type { PmTask, TaskStatus } from "@/types/pm";

interface Props {
  tasks: PmTask[];
  onNewTicket: () => void;
  onBatchPaste: () => void;
}

type ColumnTone = "default" | "done" | "archive";

// Ordered QA columns (mapped from underlying TaskStatus).
const COLUMNS: { id: string; label: string; statuses: TaskStatus[]; tone: ColumnTone }[] = [
  { id: "new", label: "New", statuses: ["unclaimed"], tone: "default" },
  { id: "triage", label: "Triaging", statuses: ["claimed"], tone: "default" },
  { id: "fix", label: "In Fix", statuses: ["in_progress", "blocked"], tone: "default" },
  { id: "verify", label: "Ready to Verify", statuses: ["in_review"], tone: "default" },
  { id: "verified", label: "Verified", statuses: ["complete"], tone: "done" },
  { id: "closed", label: "Closed", statuses: ["approved"], tone: "archive" },
];

function columnShellClass(tone: ColumnTone): string {
  switch (tone) {
    case "done":
      return "bg-success/10 border border-success/20";
    case "archive":
      return "bg-muted/50 border border-border";
    default:
      return "bg-secondary/40";
  }
}

function columnHeaderClass(tone: ColumnTone): string {
  switch (tone) {
    case "done":
      return "text-success";
    case "archive":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function columnBadgeClass(tone: ColumnTone): string {
  switch (tone) {
    case "done":
      return "border-success/30 text-success bg-success/10";
    case "archive":
      return "border-border text-muted-foreground bg-muted/40";
    default:
      return "";
  }
}

export function QaTab({ tasks, onNewTicket, onBatchPaste }: Props) {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<QaSeverity | "all">("all");
  const [showClosed, setShowClosed] = useState(false);
  const navigate = useTaskDrawerLink();

  const qaTasks = useMemo(
    () => tasks.filter(t => getTaskKind(t) === "qa"),
    [tasks],
  );

  /** Stat-chip drill-down: clicking a count narrows the board to that slice. */
  const [statFilter, setStatFilter] = useState<"new" | "in_fix" | "ready" | "blockers" | null>(null);

  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return qaTasks.filter(t => {
      const details = getQaDetails(t);
      if (severityFilter !== "all" && details.severity !== severityFilter) return false;
      if (!q) return true;
      const hay = `${t.title} ${details.environment ?? ""} ${details.reported_by_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [qaTasks, query, severityFilter]);

  const open = baseFiltered.filter(t => t.status !== "complete" && t.status !== "approved");
  const blockers = open.filter(t => getQaDetails(t).severity === "blocker").length;
  const inFix = open.filter(t => t.status === "in_progress" || t.status === "blocked").length;
  const readyToVerify = open.filter(t => t.status === "in_review").length;
  const newCount = open.filter(t => t.status === "unclaimed").length;

  const filtered = useMemo(() => {
    if (!statFilter) return baseFiltered;
    const isOpen = (t: PmTask) => t.status !== "complete" && t.status !== "approved";
    switch (statFilter) {
      case "new": return baseFiltered.filter(t => isOpen(t) && t.status === "unclaimed");
      case "in_fix": return baseFiltered.filter(t => isOpen(t) && (t.status === "in_progress" || t.status === "blocked"));
      case "ready": return baseFiltered.filter(t => isOpen(t) && t.status === "in_review");
      case "blockers": return baseFiltered.filter(t => isOpen(t) && getQaDetails(t).severity === "blocker");
    }
  }, [baseFiltered, statFilter]);


  const byColumn = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const t of filtered) {
      const col = COLUMNS.find(c => c.statuses.includes(t.status));
      if (col) map.get(col.id)!.push(t);
    }
    // sort each: blockers first, then priority, then newest
    const sevRank: Record<string, number> = { blocker: 0, major: 1, minor: 2, cosmetic: 3 };
    for (const [, list] of map) {
      list.sort((a, b) => {
        const sa = sevRank[getQaDetails(a).severity ?? "minor"] ?? 4;
        const sb = sevRank[getQaDetails(b).severity ?? "minor"] ?? 4;
        if (sa !== sb) return sa - sb;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      });
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Bug className="h-4 w-4 text-[hsl(345_80%_55%)]" />
          <span className="font-medium">QA triage</span>
          <span className="text-muted-foreground">·</span>
          <StatChip label="New" value={newCount} tone="muted" active={statFilter === "new"} onClick={() => setStatFilter(statFilter === "new" ? null : "new")} />
          <StatChip label="In fix" value={inFix} tone="amber" active={statFilter === "in_fix"} onClick={() => setStatFilter(statFilter === "in_fix" ? null : "in_fix")} />
          <StatChip label="Ready to verify" value={readyToVerify} tone="info" active={statFilter === "ready"} onClick={() => setStatFilter(statFilter === "ready" ? null : "ready")} />
          <StatChip label="Blockers" value={blockers} tone={blockers > 0 ? "destructive" : "muted"} active={statFilter === "blockers"} onClick={() => setStatFilter(statFilter === "blockers" ? null : "blockers")} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBatchPaste}>
            <ListPlus className="h-4 w-4 mr-1" /> Log QA batch
          </Button>
          <Button size="sm" onClick={onNewTicket}>
            <Plus className="h-4 w-4 mr-1" /> New ticket
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-[220px] max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, URL, or reporter"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSeverityFilter("all")}
            className={cn(
              "px-2 h-7 rounded-full text-[11px] font-medium border transition",
              severityFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:text-foreground",
            )}
          >
            All
          </button>
          {QA_SEVERITIES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverityFilter(s === severityFilter ? "all" : s)}
              className={cn(
                "px-2 h-7 rounded-full text-[11px] font-medium border capitalize transition",
                s === severityFilter ? QA_SEVERITY_STYLE[s] : "bg-background text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {qaTasks.length === 0 ? (
        <Card className="bg-secondary/50">
          <CardContent className="p-8 text-center space-y-3">
            <Bug className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">No QA tickets yet.</div>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={onBatchPaste}>
                <ListPlus className="h-4 w-4 mr-1" /> Paste a list from the client
              </Button>
              <Button size="sm" variant="outline" onClick={onNewTicket}>
                <Plus className="h-4 w-4 mr-1" /> Log a single ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {COLUMNS.map(col => {
            const items = byColumn.get(col.id) ?? [];
            const isArchive = col.tone === "archive";
            const collapsed = isArchive && !showClosed && items.length > 0;
            const isDoneLane = col.tone === "done" || col.tone === "archive";

            return (
              <Card key={col.id} className={columnShellClass(col.tone)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn(
                      "text-xs font-semibold uppercase tracking-wide inline-flex items-center gap-1.5",
                      columnHeaderClass(col.tone),
                    )}>
                      {isDoneLane && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                      {col.label}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("tabular-nums", columnBadgeClass(col.tone))}
                    >
                      {items.length}
                    </Badge>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-4 text-center">—</div>
                  ) : collapsed ? (
                    <button
                      type="button"
                      onClick={() => setShowClosed(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-3 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      Show {items.length} closed
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {isArchive && (
                        <button
                          type="button"
                          onClick={() => setShowClosed(false)}
                          className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition"
                        >
                          <ChevronDown className="h-3 w-3" />
                          Hide closed
                        </button>
                      )}
                      {items.map(t => (
                        <QaCard
                          key={t.id}
                          task={t}
                          tone={col.tone}
                          onOpen={() => navigate.open(t.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QaCard({
  task,
  tone = "default",
  onOpen,
}: {
  task: PmTask;
  tone?: ColumnTone;
  onOpen: () => void;
}) {
  const details = getQaDetails(task);
  const sev = details.severity ?? "minor";
  const isDone = tone === "done";
  const isArchive = tone === "archive";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-md border p-2.5 space-y-1.5 hover:border-foreground/30 hover:shadow-sm transition",
        isDone || isArchive
          ? "bg-background/70 border-border/60"
          : "border-border bg-background",
        isArchive && "opacity-80",
      )}
    >
      <div className="flex items-start gap-2">
        <PriorityFlag priority={task.priority} size="xs" className="mt-0.5" />
        <div className="text-[13px] leading-snug font-medium flex-1 line-clamp-2">{task.title}</div>
        <MultiAssigneeChip taskId={task.id} primaryId={task.assignee_id} size="xs" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0 rounded-full border", QA_SEVERITY_STYLE[sev])}>
          {sev}
        </span>
        <span className={cn(
          "text-[10px]",
          isDone ? "text-success font-medium" : "text-muted-foreground",
        )}>
          {getKindStatusLabel(task.status, "qa")}
        </span>
        {details.environment && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={details.environment}>
            · {details.environment}
          </span>
        )}
      </div>
      {(details.reported_by_name || task.due_date) && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate">{details.reported_by_name ? `by ${details.reported_by_name}` : ""}</span>
          {task.due_date && <span>{fmtDate(task.due_date)}</span>}
        </div>
      )}
    </button>
  );
}

function StatChip({ label, value, tone, active, onClick }: { label: string; value: number; tone: "muted" | "amber" | "info" | "destructive"; active?: boolean; onClick?: () => void }) {
  const cls = {
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? `Clear ${label} filter` : `Show only ${label}`}
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-medium transition hover:opacity-80",
        cls,
        active && "ring-2 ring-foreground/50",
      )}
    >
      <span className="tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </button>
  );
}

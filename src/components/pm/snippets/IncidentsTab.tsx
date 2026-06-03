import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSiblingDone, useAllIncidents, type IncidentSeverity } from "@/lib/pm/snippetIncidents";
import { SnippetIncidentDrawer } from "./SnippetIncidentDrawer";

const SEVERITY_STYLE: Record<IncidentSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

type Filter = "active" | "resolved" | "all";

export function IncidentsTab() {
  const { data = [], isLoading } = useAllIncidents();
  const [filter, setFilter] = useState<Filter>("active");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "active") return data.filter(i => !i.resolved_at);
    return data.filter(i => !!i.resolved_at);
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">
          Showing {filtered.length} incident{filtered.length === 1 ? "" : "s"}
        </div>
        <div className="flex border border-border rounded-md overflow-hidden text-[12px]">
          {(["active", "resolved", "all"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 capitalize",
                filter === f
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-[13px] text-muted-foreground py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground text-sm">
          No incidents to show.
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {filtered.map(i => {
            const done = i.siblings.filter(isSiblingDone).length;
            const total = i.siblings.length;
            const allDone = total > 0 && done === total;
            return (
              <button
                key={i.id}
                onClick={() => setOpenId(i.id)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                {i.resolved_at ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{i.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {i.snippet_title} · reported {new Date(i.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={
                    "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border " +
                    SEVERITY_STYLE[i.severity]
                  }
                >
                  {i.severity}
                </span>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    allDone ? "text-success font-medium" : "text-muted-foreground",
                  )}
                >
                  {done}/{total} fixed
                </span>
              </button>
            );
          })}
        </div>
      )}

      <SnippetIncidentDrawer incidentId={openId} onOpenChange={v => !v && setOpenId(null)} />
    </div>
  );
}

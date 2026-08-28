import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchLinkedSupportRequests } from "@/lib/pm/liveSites";
import { REQUEST_TYPE_LABELS } from "@/lib/pm/requestTypes";
import { fmtDate } from "@/lib/pm/format";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject } from "@/types/pm";
import { cn } from "@/lib/utils";

/** Lists quick requests nested under a live career site via parent_project_id. */
export function LinkedSupportRequests({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<PmProject[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchLinkedSupportRequests(projectId));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);
  useTasksChanged(reload);

  if (loading && rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Loading linked requests…</CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Linked support requests
          </div>
          <p className="text-sm text-muted-foreground">
            No Career Site Support requests are nested under this site yet. New careersite_* intake will link here automatically when this is the client’s live site.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Linked support requests
          </div>
          <Badge variant="secondary" className="tabular-nums">{rows.length}</Badge>
        </div>
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const rt = (r.custom_fields as { request_type?: string } | null)?.request_type;
            const label = rt ? (REQUEST_TYPE_LABELS[rt as keyof typeof REQUEST_TYPE_LABELS] ?? rt) : null;
            const inactive = r.status === "complete" || r.status === "archived";
            return (
              <li key={r.id}>
                <Link
                  to={`/pm/projects/${r.id}`}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40",
                    inactive && "opacity-60",
                  )}
                >
                  <span className="min-w-0 truncate font-medium">{r.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {label ? `${label} · ` : ""}
                    {r.go_live_date ? `Due ${fmtDate(r.go_live_date)}` : r.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SiteInitiativeRollup } from "@/lib/pm/siteInitiatives";
import { fmtDateShort } from "@/lib/pm/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<SiteInitiativeRollup["items"][number]["rollupStatus"], string> = {
  needs_triage: "Needs triage",
  in_progress: "In progress",
  waiting: "Blocked / waiting",
  closed: "Done",
};

export function SiteInitiativeCard({
  rollup,
}: {
  rollup: SiteInitiativeRollup;
}) {
  const { initiative, kind, items, totals } = rollup;
  const pct = totals.sites
    ? Math.round((totals.completed / totals.sites) * 100)
    : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/pm/projects/${initiative.id}`}
                className="text-sm font-semibold hover:text-primary truncate"
              >
                {initiative.title}
              </Link>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide capitalize">
                {kind}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {totals.sites} site{totals.sites === 1 ? "" : "s"}
              {initiative.go_live_date
                ? ` · Due ${fmtDateShort(initiative.go_live_date)}`
                : ""}
              {` · ${pct}% complete`}
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link to={`/pm/projects/${initiative.id}`}>Open</Link>
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <MiniStat label="Done" value={totals.completed} accent="text-foreground" />
          <MiniStat label="In progress" value={totals.inProgress} />
          <MiniStat
            label="Triage"
            value={totals.needsTriage}
            accent={totals.needsTriage > 0 ? "text-primary" : undefined}
          />
          <MiniStat
            label="Blocked"
            value={totals.blocked}
            accent={totals.blocked > 0 ? "text-warning" : undefined}
          />
        </div>

        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <li key={item.link.id}>
              <Link
                to={`/pm/projects/${item.request.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.site.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] uppercase tracking-wide",
                    item.rollupStatus === "closed" && "text-muted-foreground",
                    item.rollupStatus === "waiting" && "text-warning",
                    item.rollupStatus === "needs_triage" && "text-primary",
                    item.rollupStatus === "in_progress" && "text-foreground",
                  )}
                >
                  {STATUS_LABEL[item.rollupStatus]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MiniStat({
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
      <div className={cn("text-sm font-semibold tabular-nums", accent ?? "text-muted-foreground")}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

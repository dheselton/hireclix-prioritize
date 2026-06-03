import { useMemo, useState } from "react";
import { AlertTriangle, Code } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  isSiblingDone,
  useIncident,
  useIncidentSiblings,
  type IncidentSeverity,
} from "@/lib/pm/snippetIncidents";
import { SnippetIncidentDrawer } from "@/components/pm/snippets/SnippetIncidentDrawer";

interface Props {
  incidentId: string;
  snippetId?: string | null;
  currentTaskId: string;
}

const SEVERITY_STYLE: Record<IncidentSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function IncidentContextBanner({ incidentId, snippetId, currentTaskId }: Props) {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: incident } = useIncident(incidentId);
  const { data: siblings = [] } = useIncidentSiblings(incidentId);

  const { done, total, others } = useMemo(() => {
    const others = siblings.filter(s => s.taskId !== currentTaskId);
    return {
      done: siblings.filter(isSiblingDone).length,
      total: siblings.length,
      others,
    };
  }, [siblings, currentTaskId]);

  if (!incident) return null;

  return (
    <>
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-destructive">
              Part of broken-snippet incident: “{incident.title}”
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {done} of {total} site{total === 1 ? "" : "s"} fixed
            </div>
          </div>
          <span
            className={
              "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border " +
              SEVERITY_STYLE[incident.severity]
            }
          >
            {incident.severity}
          </span>
        </div>

        {others.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-6">
            {others.slice(0, 8).map(s => {
              const fixed = isSiblingDone(s);
              return (
                <button
                  key={s.taskId}
                  onClick={() => navigate(`/pm/tasks/${s.taskId}`)}
                  title={`${s.projectTitle} — ${s.taskTitle}`}
                  className={
                    "text-[11px] px-1.5 py-0.5 rounded border " +
                    (fixed
                      ? "bg-success/15 text-success border-success/30"
                      : "bg-muted text-muted-foreground border-border hover:bg-accent")
                  }
                >
                  {fixed ? "✓ " : ""}
                  {s.projectTitle}
                </button>
              );
            })}
            {others.length > 8 && (
              <span className="text-[11px] text-muted-foreground px-1.5 py-0.5">
                +{others.length - 8} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pl-6">
          <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)}>
            View incident
          </Button>
          {snippetId && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5">
              <a href="/snippets">
                <Code className="h-3.5 w-3.5" /> View snippet
              </a>
            </Button>
          )}
        </div>
      </div>

      <SnippetIncidentDrawer
        incidentId={drawerOpen ? incidentId : null}
        onOpenChange={v => setDrawerOpen(v)}
      />
    </>
  );
}

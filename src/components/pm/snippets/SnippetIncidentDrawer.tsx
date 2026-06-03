import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/pm/StatusPill";
import { useMockUsers } from "@/lib/pm/mockUser";
import {
  isSiblingDone,
  reopenIncident,
  resolveIncident,
  useIncident,
  useIncidentSiblings,
  type IncidentSeverity,
} from "@/lib/pm/snippetIncidents";

interface Props {
  incidentId: string | null;
  onOpenChange: (v: boolean) => void;
}

const SEVERITY_STYLE: Record<IncidentSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function SnippetIncidentDrawer({ incidentId, onOpenChange }: Props) {
  const open = !!incidentId;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const users = useMockUsers();
  const { data: incident } = useIncident(incidentId);
  const { data: siblings = [] } = useIncidentSiblings(incidentId);

  const done = siblings.filter(isSiblingDone).length;
  const total = siblings.length;
  const userById = new Map(users.map(u => [u.id, u]));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["snippet-incident", incidentId] });
    qc.invalidateQueries({ queryKey: ["snippet-incident-siblings", incidentId] });
    qc.invalidateQueries({ queryKey: ["snippet-incident-active"] });
    qc.invalidateQueries({ queryKey: ["snippet-incidents-all"] });
  };

  const handleResolve = async () => {
    if (!incident) return;
    await resolveIncident(incident.id);
    invalidate();
    toast.success("Incident resolved");
  };

  const handleReopen = async () => {
    if (!incident) return;
    await reopenIncident(incident.id);
    invalidate();
    toast.success("Incident reopened");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Broken snippet incident
          </SheetTitle>
        </SheetHeader>

        {!incident ? (
          <div className="text-sm text-muted-foreground py-6">Loading…</div>
        ) : (
          <div className="space-y-5 mt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-medium">{incident.title}</h3>
                <span
                  className={
                    "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border " +
                    SEVERITY_STYLE[incident.severity]
                  }
                >
                  {incident.severity}
                </span>
                {incident.resolved_at && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border bg-success/15 text-success border-success/30">
                    Resolved
                  </span>
                )}
              </div>
              {incident.description && (
                <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">
                  {incident.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">{done}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span> site
                {total === 1 ? "" : "s"} fixed
              </div>
              {incident.resolved_at ? (
                <Button variant="outline" size="sm" onClick={handleReopen} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </Button>
              ) : (
                <Button size="sm" onClick={handleResolve} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
                </Button>
              )}
            </div>

            <div className="border border-border rounded-md divide-y divide-border">
              {siblings.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No follow-up tasks yet.
                </div>
              ) : (
                siblings.map(s => {
                  const assignee = s.assigneeId ? userById.get(s.assigneeId) : null;
                  return (
                    <button
                      key={s.taskId}
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/pm/tasks/${s.taskId}`);
                      }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-muted/40"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] truncate">{s.projectTitle}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {s.taskTitle}
                          {s.dueDate ? ` · due ${s.dueDate}` : ""}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                        {assignee?.name ?? "Unassigned"}
                      </span>
                      <StatusPill status={s.status} className="text-[10px] py-0 px-1.5" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { AlertTriangle } from "lucide-react";
import {
  useIncidentSiblings,
  useSnippetActiveIncident,
  isSiblingDone,
} from "@/lib/pm/snippetIncidents";

interface Props {
  snippetId: string;
  onOpen: (incidentId: string) => void;
}

/** Inline warning shown on a SnippetCard when there's an unresolved incident. */
export function SnippetIncidentBanner({ snippetId, onOpen }: Props) {
  const { data: incident } = useSnippetActiveIncident(snippetId);
  const { data: siblings = [] } = useIncidentSiblings(incident?.id);

  if (!incident) return null;

  const done = siblings.filter(isSiblingDone).length;
  const total = siblings.length;

  return (
    <button
      onClick={() => onOpen(incident.id)}
      className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-md border border-destructive/30 bg-destructive/10 hover:bg-destructive/15 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-destructive truncate">
            Active incident · {incident.title}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {done} of {total} site{total === 1 ? "" : "s"} fixed
          </div>
        </div>
      </div>
      <span className="text-[11px] text-destructive font-medium shrink-0">View</span>
    </button>
  );
}

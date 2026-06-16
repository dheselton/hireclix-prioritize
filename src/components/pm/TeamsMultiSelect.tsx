import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_TEAMS, TEAM_LABEL, TEAM_COLOR, type Team } from "@/lib/pm/teams";

interface Props {
  value: Team[];
  onChange: (next: Team[]) => void;
  size?: "sm" | "md";
  align?: "start" | "end" | "center";
  /** Render as compact chips row instead of full pill+popover trigger */
  compact?: boolean;
}

export function TeamsMultiSelect({ value, onChange, size = "sm", align = "end", compact = false }: Props) {
  const set = new Set<Team>(value);
  const toggle = (t: Team) => {
    const next = new Set(set);
    if (next.has(t)) next.delete(t); else next.add(t);
    onChange(Array.from(next));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1", align === "end" && "justify-end")}>
      {value.length > 0 ? (
        value.map(t => (
          <TeamPill key={t} team={t} />
        ))
      ) : !compact ? (
        <span className="text-xs italic text-muted-foreground">No teams</span>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-6 px-1.5 text-xs gap-1 text-muted-foreground hover:text-foreground")}
            aria-label="Edit teams"
          >
            {value.length === 0 ? <Users className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {value.length === 0 && !compact && <span>Add team</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} className="z-50 w-48 p-1 bg-popover">
          {ALL_TEAMS.map(t => {
            const on = set.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted",
                  on && "font-medium",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: TEAM_COLOR[t] }} />
                  {TEAM_LABEL[t]}
                </span>
                {on && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TeamPill({ team }: { team: Team }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-muted/40"
      style={{ borderColor: TEAM_COLOR[team] }}
      title={TEAM_LABEL[team]}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAM_COLOR[team] }} />
      {TEAM_LABEL[team]}
    </span>
  );
}

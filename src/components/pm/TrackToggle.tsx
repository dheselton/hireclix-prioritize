import { cn } from "@/lib/utils";
import { useTrackMode, type TrackMode } from "@/hooks/useTrackMode";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { userTrack } from "@/lib/pm/track";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TrackToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTrackMode();
  const { user } = useCurrentUser();
  const myTrack = userTrack(user);
  const otherLabel = myTrack === "pm" ? "Production" : "PM";
  const mineLabel = myTrack === "pm" ? "PM" : "Production";

  const opts: { v: TrackMode; label: string; tip: string }[] = [
    { v: "mine",  label: mineLabel,  tip: `Show only ${mineLabel} tasks` },
    { v: "other", label: otherLabel, tip: `Peek at ${otherLabel} tasks` },
    { v: "all",   label: "All",      tip: "Show all tasks" },
  ];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center rounded-md border border-border bg-background p-0.5",
            className,
          )}
          role="group"
          aria-label="Track filter"
        >
          {opts.map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              title={o.tip}
              className={cn(
                "px-2.5 h-7 text-xs font-medium rounded transition-colors",
                mode === o.v
                  ? (o.v === "mine"
                      ? (myTrack === "pm" ? "bg-[hsl(var(--track-pm))] text-white" : "bg-[hsl(var(--track-production))] text-white")
                      : "bg-primary text-primary-foreground")
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Default = your team's tasks. Click <span className="font-medium">{otherLabel}</span> to peek.
      </TooltipContent>
    </Tooltip>
  );
}

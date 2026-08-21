import { cn } from "@/lib/utils";
import type { WorkTypeFilter } from "@/hooks/useWorkTypeFilter";

interface Props {
  value: WorkTypeFilter;
  onChange: (v: WorkTypeFilter) => void;
  className?: string;
}

const OPTIONS: { id: WorkTypeFilter; label: string; shortLabel: string; hint: string }[] = [
  { id: "all", label: "All work", shortLabel: "All", hint: "All work across the team" },
  { id: "request", label: "Quick requests", shortLabel: "Quick", hint: "Lightweight, single-task projects" },
  { id: "project", label: "Full projects", shortLabel: "Projects", hint: "Multi-task projects with a timeline" },
];

export function WorkTypeFilterToggle({ value, onChange, className }: Props) {
  return (
    <div className={cn("inline-flex items-center rounded-md border border-border bg-background p-0.5", className)}>
      {OPTIONS.map(o => (
        <button
          key={o.id}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2 sm:px-2.5 h-8 sm:h-7 text-xs rounded transition whitespace-nowrap",
            value === o.id
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="sm:hidden">{o.shortLabel}</span>
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

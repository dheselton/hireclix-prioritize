import { cn } from "@/lib/utils";
import type { WorkTypeFilter } from "@/hooks/useWorkTypeFilter";

interface Props {
  value: WorkTypeFilter;
  onChange: (v: WorkTypeFilter) => void;
  className?: string;
}

const OPTIONS: { id: WorkTypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "request", label: "Requests" },
  { id: "project", label: "Projects" },
];

export function WorkTypeFilterToggle({ value, onChange, className }: Props) {
  return (
    <div className={cn("inline-flex items-center rounded-md border border-border bg-background p-0.5", className)}>
      {OPTIONS.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2.5 h-7 text-xs rounded transition",
            value === o.id
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

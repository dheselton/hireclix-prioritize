import { cn } from "@/lib/utils";
import type { WorkScope } from "@/hooks/useWorkScope";

interface Props {
  value: WorkScope;
  onChange: (v: WorkScope) => void;
  className?: string;
}

const OPTIONS: { id: WorkScope; label: string; shortLabel: string; hint: string }[] = [
  { id: "open", label: "Open", shortLabel: "Open", hint: "Current work — hides completed and retired projects" },
  { id: "completed", label: "Completed", shortLabel: "Done", hint: "Finished tasks only" },
  { id: "all", label: "All", shortLabel: "All", hint: "Everything, including completed and retired" },
];

export function WorkScopeToggle({ value, onChange, className }: Props) {
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

import { List, LayoutGrid, Columns } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/useViewMode";

type Mode = ViewMode | "kanban";

interface ViewToggleProps {
  value: Mode;
  onChange: (m: Mode) => void;
  modes?: Mode[];
  className?: string;
}

const ICONS: Record<Mode, React.ReactNode> = {
  list: <List className="h-4 w-4" />,
  grid: <LayoutGrid className="h-4 w-4" />,
  kanban: <Columns className="h-4 w-4" />,
};

const LABELS: Record<Mode, string> = {
  list: "List view",
  grid: "Grid view",
  kanban: "Kanban view",
};

export function ViewToggle({ value, onChange, modes = ["list", "grid"], className }: ViewToggleProps) {
  return (
    <div className={cn("inline-flex items-center rounded-md border border-border bg-background p-0.5", className)}>
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-label={LABELS[m]}
          title={LABELS[m]}
          className={cn(
            "inline-flex items-center justify-center h-7 w-8 rounded transition-colors",
            value === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {ICONS[m]}
        </button>
      ))}
    </div>
  );
}

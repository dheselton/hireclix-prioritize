import { cn } from "@/lib/utils";
import { ALL_CHIPS, type ChipId } from "@/hooks/useChipFilters";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  active: Set<ChipId>;
  onToggle: (id: ChipId) => void;
  onClear: () => void;
  hide?: ChipId[];
  counts?: Partial<Record<ChipId, number>>;
}

export function FilterChipBar({ active, onToggle, onClear, hide, counts }: Props) {
  const chips = ALL_CHIPS.filter(c => !hide?.includes(c.id));
  const hasActive = active.size > 0;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map(c => {
        const on = active.has(c.id);
        const cnt = counts?.[c.id];
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={cn(
              "h-7 px-2.5 rounded-full text-xs border transition-colors",
              on
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted",
            )}
          >
            {c.label}{typeof cnt === "number" ? ` (${cnt})` : ""}
          </button>
        );
      })}
      {hasActive && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}

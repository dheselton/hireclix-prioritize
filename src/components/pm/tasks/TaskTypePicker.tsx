import { useMemo } from "react";
import { Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TYPE_LABEL } from "@/hooks/useTypeFilter";
import { cn } from "@/lib/utils";
import { TASK_TYPES, TYPE_COLORS, type TaskType } from "@/types/pm";

interface Props {
  value: TaskType[];
  onChange: (types: TaskType[]) => void;
  /** Tighter layout for the workspace control panel. */
  compact?: boolean;
}

export function TaskTypePicker({ value, onChange, compact }: Props) {
  const remainingTypes = useMemo(() => TASK_TYPES.filter(t => !value.includes(t)), [value]);

  function addType(t: TaskType) {
    if (value.includes(t)) return;
    onChange([...value, t]);
  }

  function removeType(t: TaskType) {
    if (value.length <= 1) return;
    onChange(value.filter(x => x !== t));
  }

  function promoteType(t: TaskType) {
    if (!value.includes(t) || value[0] === t) return;
    onChange([t, ...value.filter(x => x !== t)]);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background",
        compact ? "min-h-7 px-1.5 py-0.5 justify-end" : "min-h-9 px-2 py-1.5",
      )}
    >
      {value.map((t, i) => {
        const isPrimary = i === 0;
        return (
          <span
            key={t}
            className={cn(
              "inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border text-xs",
              isPrimary ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/40 cursor-pointer hover:bg-muted",
            )}
            onClick={() => !isPrimary && promoteType(t)}
            title={isPrimary ? `${TYPE_LABEL[t]} (primary)` : `Click to make ${TYPE_LABEL[t]} primary`}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[t] }} />
            <span className="font-medium">{TYPE_LABEL[t]}</span>
            {isPrimary && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />}
            {value.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeType(t); }}
                aria-label={`Remove ${TYPE_LABEL[t]}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      })}
      {remainingTypes.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1 z-50 bg-popover">
            {remainingTypes.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => addType(t)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                {TYPE_LABEL[t]}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FilterChipBar } from "@/components/pm/FilterChipBar";
import { WorkTypeFilterToggle } from "@/components/pm/WorkTypeFilterToggle";
import { TagFilterChip } from "@/components/pm/tags/TagFilterChip";
import type { ChipId } from "@/hooks/useChipFilters";
import type { WorkTypeFilter } from "@/hooks/useWorkTypeFilter";
import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  workType: WorkTypeFilter;
  onWorkTypeChange: (v: WorkTypeFilter) => void;
  chipState: {
    active: Set<ChipId>;
    toggle: (id: ChipId) => void;
    clear: () => void;
    hide?: ChipId[];
    counts?: Partial<Record<ChipId, number>>;
  };
  tagValue: string[];
  onTagToggle: (tag: string) => void;
  onTagClear: () => void;
  extraTags?: string[];
  onClearAll: () => void;
}

/** Compact trigger + bottom sheet for Work filters on narrow screens. */
export function WorkFiltersSheet({
  open,
  onOpenChange,
  activeCount,
  workType,
  onWorkTypeChange,
  chipState,
  tagValue,
  onTagToggle,
  onTagClear,
  extraTags,
  onClearAll,
}: Props) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-10 px-3 shrink-0 ${activeCount > 0 ? "border-primary text-primary" : ""}`}
        onClick={() => onOpenChange(true)}
      >
        <SlidersHorizontal className="h-4 w-4 mr-1.5" />
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px]">
            {activeCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 space-y-4 safe-bottom">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center justify-between gap-2 pr-8">
              <span>Filters</span>
              {activeCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onClearAll}
                >
                  Clear all
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Work type
              </div>
              <WorkTypeFilterToggle value={workType} onChange={onWorkTypeChange} className="flex w-full [&>button]:flex-1" />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Quick filters
              </div>
              <FilterChipBar
                active={chipState.active}
                onToggle={chipState.toggle}
                onClear={chipState.clear}
                hide={chipState.hide}
                counts={chipState.counts}
              />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </div>
              <TagFilterChip
                value={tagValue}
                onToggle={onTagToggle}
                onClear={onTagClear}
                extraTags={extraTags}
              />
            </div>

            <Button type="button" className="w-full h-11" onClick={() => onOpenChange(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

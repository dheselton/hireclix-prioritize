import { ReactNode } from "react";
import { MeModeToggle } from "./MeModeToggle";
import { ViewToggle } from "./ViewToggle";
import { FilterChipBar } from "./FilterChipBar";
import { TypeFilterLabel } from "./TypeFilterLabel";
import type { ChipId } from "@/hooks/useChipFilters";
import type { ViewMode } from "@/hooks/useViewMode";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = ViewMode | "kanban";

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  mode?: Mode;
  onModeChange?: (m: Mode) => void;
  modes?: Mode[];
  showMeMode?: boolean;
  typeFilterPage?: string;
  chipState?: {
    active: Set<ChipId>;
    toggle: (id: ChipId) => void;
    clear: () => void;
    hide?: ChipId[];
    counts?: Partial<Record<ChipId, number>>;
  };
  /** Hide the inline chip bar (e.g. when filters live in a mobile sheet). */
  hideChips?: boolean;
  extraControls?: ReactNode;
  /** Optional search field shown under the title row. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchTrailing?: ReactNode;
}

export function CollectionToolbar({
  title, subtitle, actions, mode, onModeChange, modes,
  showMeMode = true, typeFilterPage, chipState, hideChips = false, extraControls,
  search, onSearchChange, searchPlaceholder = "Search…", searchTrailing,
}: Props) {
  return (
    <div className="space-y-3 min-w-0">
      {/* Row 1: Title + primary actions — stacked on mobile so subtitle isn't crushed */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 w-full sm:flex-1">
          <h1 className="text-xl md:text-2xl font-bold font-unbounded truncate">{title}</h1>
          {subtitle && (
            <p className="hidden sm:block text-xs md:text-sm text-muted-foreground mt-0.5 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-nowrap justify-start sm:justify-end touch-scroll-x no-scrollbar sm:!overflow-visible w-full sm:w-auto">
            {actions}
          </div>
        )}
      </div>

      {/* Search + trailing filter trigger */}
      {(onSearchChange != null || searchTrailing) && (
        <div className="flex items-center gap-2 min-w-0">
          {onSearchChange != null && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 pl-9 pr-9"
                aria-label="Search work"
              />
              {(search ?? "").length > 0 && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {searchTrailing}
        </div>
      )}

      {/* Row 2: Secondary controls */}
      {(extraControls || showMeMode || (mode && onModeChange)) && (
        <div className="flex items-center gap-2 flex-nowrap md:flex-wrap touch-scroll-x no-scrollbar md:!overflow-visible">
          {extraControls}
          <div className={cn("ml-auto flex items-center gap-2 flex-nowrap shrink-0")}>
            {showMeMode && <MeModeToggle />}
            {mode && onModeChange && (
              <ViewToggle value={mode} onChange={onModeChange} modes={modes} />
            )}
          </div>
        </div>
      )}

      {chipState && !hideChips && (
        <FilterChipBar
          active={chipState.active}
          onToggle={chipState.toggle}
          onClear={chipState.clear}
          hide={chipState.hide}
          counts={chipState.counts}
        />
      )}
      {typeFilterPage && <TypeFilterLabel page={typeFilterPage} />}
    </div>
  );
}

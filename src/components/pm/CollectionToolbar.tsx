import { ReactNode } from "react";
import { MeModeToggle } from "./MeModeToggle";
import { ViewToggle } from "./ViewToggle";
import { FilterChipBar } from "./FilterChipBar";
import { TypeFilterLabel } from "./TypeFilterLabel";
import type { ChipId } from "@/hooks/useChipFilters";
import type { ViewMode } from "@/hooks/useViewMode";

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
  extraControls?: ReactNode;
}

export function CollectionToolbar({
  title, subtitle, actions, mode, onModeChange, modes,
  showMeMode = true, typeFilterPage, chipState, extraControls,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Row 1: Title + primary actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold font-unbounded truncate">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-nowrap md:flex-wrap justify-end touch-scroll-x no-scrollbar md:!overflow-visible">
            {actions}
          </div>
        )}
      </div>

      {/* Row 2: Secondary controls — horizontally scrollable on mobile, wraps on ≥md */}
      {(extraControls || showMeMode || (mode && onModeChange)) && (
        <div className="flex items-center gap-2 flex-nowrap md:flex-wrap touch-scroll-x no-scrollbar md:!overflow-visible">
          {extraControls}
          <div className="ml-auto flex items-center gap-2 flex-nowrap md:flex-wrap shrink-0">
            {showMeMode && <MeModeToggle />}
            {mode && onModeChange && (
              <ViewToggle value={mode} onChange={onModeChange} modes={modes} />
            )}
          </div>
        </div>
      )}

      {chipState && (
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

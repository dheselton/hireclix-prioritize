import { ReactNode } from "react";
import { MeModeToggle } from "./MeModeToggle";
import { TrackToggle } from "./TrackToggle";
import { ViewToggle } from "./ViewToggle";
import { FilterChipBar } from "./FilterChipBar";
import type { ChipId } from "@/hooks/useChipFilters";
import type { ViewMode } from "@/hooks/useViewMode";

type Mode = ViewMode | "kanban";

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** when omitted, no view toggle is rendered */
  mode?: Mode;
  onModeChange?: (m: Mode) => void;
  modes?: Mode[];
  showMeMode?: boolean;
  showTrack?: boolean;
  /** filter-chip wiring; when omitted the chip row is hidden */
  chipState?: {
    active: Set<ChipId>;
    toggle: (id: ChipId) => void;
    clear: () => void;
    hide?: ChipId[];
    counts?: Partial<Record<ChipId, number>>;
  };
  /** extra controls (e.g. project filter Select) placed before Me|All */
  extraControls?: ReactNode;
}

export function CollectionToolbar({
  title, subtitle, actions, mode, onModeChange, modes,
  showMeMode = true, showTrack = true, chipState, extraControls,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-unbounded">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {extraControls}
          {showTrack && <TrackToggle />}
          {showMeMode && <MeModeToggle />}
          {mode && onModeChange && (
            <ViewToggle value={mode} onChange={onModeChange} modes={modes} />
          )}
        </div>
      </div>
      {chipState && (
        <FilterChipBar
          active={chipState.active}
          onToggle={chipState.toggle}
          onClear={chipState.clear}
          hide={chipState.hide}
          counts={chipState.counts}
        />
      )}
    </div>
  );
}

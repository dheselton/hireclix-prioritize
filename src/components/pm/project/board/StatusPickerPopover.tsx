import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_GROUPS, type StatusGroupId } from "@/lib/pm/statusGroups";
import { STATUS_PILL_CLASS, STATUS_DOT_CLASS } from "./boardStyles";
import { useState } from "react";

export function StatusPickerPopover({
  currentGroup,
  onPick,
}: {
  currentGroup: StatusGroupId;
  onPick: (g: StatusGroupId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = STATUS_GROUPS.find(g => g.id === currentGroup)!;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded-full ${STATUS_PILL_CLASS[currentGroup]} hover:opacity-80 transition`}
        >
          {current.label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-44 p-1"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {STATUS_GROUPS.map(g => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              onPick(g.id);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-left ${
              g.id === currentGroup ? "bg-muted/60" : ""
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[g.id]}`} />
            <span>{g.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { fmtDate } from "@/lib/pm/format";

function isoToDate(v?: string | null) {
  if (!v) return undefined;
  const d = parse(v, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export function InlineDatePopover({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = isoToDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          {date ? (
            <span>{fmtDate(value)}</span>
          ) : (
            <>
              <CalendarIcon className="h-3 w-3" />
              <span>Set date</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0 bg-popover"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => {
            onChange(d ? format(d, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

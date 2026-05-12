import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
  /** ISO date string "YYYY-MM-DD" or empty/null */
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  /** Compact size for inline cells (h-8) */
  size?: "default" | "sm";
}

function isoToDate(v?: string | null): Date | undefined {
  if (!v) return undefined;
  const d = parse(v, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function dateToIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  allowClear = true,
  size = "default",
}: DatePickerProps) {
  const date = isoToDate(value);
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            size === "sm" ? "h-8 px-2 text-xs" : "h-10",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className={cn("opacity-60", size === "sm" ? "h-3.5 w-3.5 mr-1.5" : "h-4 w-4 mr-2")} />
          <span className="flex-1 truncate">{date ? format(date, "MM/dd/yyyy") : placeholder}</span>
          {allowClear && date && !disabled && (
            <X
              className={cn("opacity-50 hover:opacity-100", size === "sm" ? "h-3 w-3 ml-1" : "h-3.5 w-3.5 ml-2")}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d ? dateToIso(d) : null);
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

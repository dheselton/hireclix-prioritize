import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { addDays, startOfWeek } from "@/lib/pm/time";

export function WeekPaginator({ weekStart, onChange }: { weekStart: Date; onChange: (d: Date) => void }) {
  const end = addDays(weekStart, 6);
  const label = `${format(weekStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card">
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onChange(addDays(weekStart, -7))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium px-1 min-w-[180px] text-center">{label}</div>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onChange(addDays(weekStart, 7))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="border-l border-border h-6 mx-1" />
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange(startOfWeek(new Date()))}>
        This week
      </Button>
    </div>
  );
}

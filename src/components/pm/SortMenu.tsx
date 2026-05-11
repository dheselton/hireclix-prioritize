import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { ArrowUpDown } from "lucide-react";

export interface SortOption { id: string; label: string; }

interface Props {
  value: string;
  options: SortOption[];
  onChange: (v: string) => void;
  direction?: "asc" | "desc";
  onDirectionChange?: (d: "asc" | "desc") => void;
}

export function SortMenu({ value, options, onChange, direction = "asc", onDirectionChange }: Props) {
  const current = options.find(o => o.id === value)?.label ?? "Sort";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          {current}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 bg-popover">
        <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map(o => (
            <DropdownMenuRadioItem key={o.id} value={o.id}>{o.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {onDirectionChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDirectionChange(direction === "asc" ? "desc" : "asc")}>
              Direction: {direction === "asc" ? "Ascending" : "Descending"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

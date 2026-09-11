import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UNSET_MILESTONE_KEY,
  UNSET_MILESTONE_LABEL,
  useMilestoneDefinitions,
} from "@/lib/pm/milestones";
import { Flag } from "lucide-react";

interface Props {
  value: string[];
  onChange: (keys: string[]) => void;
}

export function MilestoneFilterToggle({ value, onChange }: Props) {
  const { data: defs = [] } = useMilestoneDefinitions();
  const selected = new Set(value);

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  }

  const label =
    value.length === 0
      ? "Milestone"
      : value.length === 1
        ? (value[0] === UNSET_MILESTONE_KEY
          ? UNSET_MILESTONE_LABEL
          : defs.find((d) => d.key === value[0])?.label ?? value[0])
        : `${value.length} milestones`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={value.length ? "default" : "outline"}
          className="h-8"
        >
          <Flag className="h-3.5 w-3.5 mr-1" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by milestone</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {defs.map((d) => (
          <DropdownMenuCheckboxItem
            key={d.key}
            checked={selected.has(d.key)}
            onCheckedChange={() => toggle(d.key)}
          >
            {d.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuCheckboxItem
          checked={selected.has(UNSET_MILESTONE_KEY)}
          onCheckedChange={() => toggle(UNSET_MILESTONE_KEY)}
        >
          {UNSET_MILESTONE_LABEL}
        </DropdownMenuCheckboxItem>
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-8 px-2"
              onClick={() => onChange([])}
            >
              Clear filter
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

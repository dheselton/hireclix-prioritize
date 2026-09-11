import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  UNSET_MILESTONE_KEY,
  UNSET_MILESTONE_LABEL,
  milestoneLabel,
  useMilestoneDefinitions,
} from "@/lib/pm/milestones";
import { cn } from "@/lib/utils";

interface MilestoneSelectProps {
  value: string | null | undefined;
  onChange: (key: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** Include inactive options that match the current value so historical keys remain selectable. */
  allowUnset?: boolean;
}

export function MilestoneSelect({
  value,
  onChange,
  disabled,
  className,
  allowUnset = true,
}: MilestoneSelectProps) {
  const { data: active = [] } = useMilestoneDefinitions();
  const { data: all = [] } = useMilestoneDefinitions({ includeInactive: true });
  const current = value ?? null;
  const options = [...active];
  if (current && !options.some((d) => d.key === current)) {
    const orphan = all.find((d) => d.key === current);
    if (orphan) options.push(orphan);
  }

  return (
    <Select
      value={current ?? UNSET_MILESTONE_KEY}
      onValueChange={(v) => onChange(v === UNSET_MILESTONE_KEY ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-8", className)}>
        <SelectValue placeholder={UNSET_MILESTONE_LABEL} />
      </SelectTrigger>
      <SelectContent className="z-50 bg-popover">
        {allowUnset && (
          <SelectItem value={UNSET_MILESTONE_KEY}>{UNSET_MILESTONE_LABEL}</SelectItem>
        )}
        {options.map((d) => (
          <SelectItem key={d.key} value={d.key}>
            {d.label}{!d.is_active ? " (inactive)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MilestoneBadge({
  milestone,
  className,
}: {
  milestone: string | null | undefined;
  className?: string;
}) {
  const { data: defs = [] } = useMilestoneDefinitions({ includeInactive: true });
  if (!milestone) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground font-normal", className)}>
        {UNSET_MILESTONE_LABEL}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("font-normal", className)}>
      {milestoneLabel(milestone, defs)}
    </Badge>
  );
}

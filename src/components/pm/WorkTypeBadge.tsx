import { cn } from "@/lib/utils";
import type { WorkType } from "@/types/pm";

interface Props {
  workType: WorkType | null | undefined;
  compact?: boolean;
  className?: string;
}

/** Small pill distinguishing Requests from Projects across cards/rows. */
export function WorkTypeBadge({ workType, compact = false, className }: Props) {
  if (!workType) return null;
  const isRequest = workType === "request";
  const label = isRequest ? "Quick" : "Full";
  const hint = isRequest ? "Quick request — lightweight project" : "Full project — multi-phase work";
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center rounded-full font-medium leading-none",
        compact
          ? "text-[9px] px-1.5 py-0.5 uppercase tracking-wide"
          : "text-[10px] px-2 py-0.5 uppercase tracking-wide",
        isRequest
          ? "bg-muted text-muted-foreground border border-border"
          : "bg-[hsl(var(--role-pm)/0.12)] text-[hsl(var(--role-pm))] border border-[hsl(var(--role-pm)/0.3)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

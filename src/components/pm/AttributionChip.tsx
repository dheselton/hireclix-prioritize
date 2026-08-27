import { UserCheck } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { useMockUsers } from "@/lib/pm/mockUser";
import {
  formatAttribution,
  type AttributionFields,
  type CreationSource,
} from "@/lib/pm/attribution";
import { cn } from "@/lib/utils";

interface Props extends AttributionFields {
  /** compact = avatar + short text; badge = outlined chip; detail = full rows */
  variant?: "compact" | "badge" | "detail";
  className?: string;
  /** Hide source badge when source is manual (less noise on everyday cards) */
  hideManualSource?: boolean;
}

/**
 * Shows who created a task/project and how it was created.
 * Collapses Requested by into Created by when they are the same person.
 */
export function AttributionChip({
  created_by,
  creation_source,
  creation_context,
  requested_by,
  variant = "compact",
  className,
  hideManualSource = true,
}: Props) {
  const users = useMockUsers();
  const display = formatAttribution(
    { created_by, creation_source, creation_context, requested_by },
    users,
  );

  const showSourceBadge =
    display.source !== "unknown" &&
    !(hideManualSource && display.source === "manual");

  if (variant === "detail") {
    return (
      <div className={cn("space-y-1 min-w-0", className)} title={display.primary}>
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar userId={display.creatorId} size="xs" />
          <span className="text-sm truncate">{display.primary}</span>
        </div>
        {display.secondary && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <UserAvatar userId={display.requesterId} size="xs" />
            <span className="truncate">{display.secondary}</span>
          </div>
        )}
      </div>
    );
  }

  if (variant === "badge") {
    return (
      <div className={cn("inline-flex flex-wrap items-center gap-1.5 min-w-0", className)}>
        <Badge
          variant="outline"
          className="gap-1 max-w-full font-normal"
          title={display.primary}
        >
          <UserAvatar userId={display.creatorId} size="xs" />
          <span className="truncate">{display.compact}</span>
        </Badge>
        {display.showRequesterSeparately && (
          <Badge variant="outline" className="bg-info/10 text-info border-info/30 gap-1 font-normal">
            <UserCheck className="h-3 w-3" />
            Requested by {users.find((u) => u.id === display.requesterId)?.name}
          </Badge>
        )}
      </div>
    );
  }

  // compact
  return (
    <div
      className={cn("inline-flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground", className)}
      title={[display.primary, display.secondary].filter(Boolean).join(" · ")}
    >
      <UserAvatar userId={display.creatorId} size="xs" />
      <span className="truncate">{display.compact}</span>
      {showSourceBadge && display.source === "unknown" && (
        <span className="shrink-0 rounded px-1 py-0.5 text-[9px] uppercase tracking-wide bg-muted text-muted-foreground">
          ?
        </span>
      )}
      {display.showRequesterSeparately && (
        <span className="truncate opacity-80">· req {users.find((u) => u.id === display.requesterId)?.name}</span>
      )}
    </div>
  );
}

/** Tiny source-only pill for dense rows when creator avatar is already shown elsewhere. */
export function CreationSourcePill({
  source,
  className,
}: {
  source?: CreationSource | string | null;
  className?: string;
}) {
  const display = formatAttribution({ creation_source: source }, []);
  if (display.source === "manual") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide font-semibold",
        display.source === "unknown"
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary",
        className,
      )}
      title={display.sourceLabel}
    >
      {display.source === "unknown" ? "Unknown" : display.sourceLabel}
    </span>
  );
}

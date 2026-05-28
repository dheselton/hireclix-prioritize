import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { cn } from "@/lib/utils";

interface Props {
  userIds: Array<string | null | undefined>;
  max?: number;
  size?: "xs" | "sm";
  /** If provided, that user renders first with a ring highlight. */
  highlightId?: string | null;
  className?: string;
  /** Show a faded look (e.g. when task is unclaimed). */
  muted?: boolean;
}

/** Overlapping avatar stack with +N overflow bubble. */
export function AvatarStack({
  userIds, max = 4, size = "xs", highlightId, className, muted,
}: Props) {
  const users = useMockUsers();
  // Dedupe + filter to known users
  const seen = new Set<string>();
  const ordered: string[] = [];
  if (highlightId && userIds.includes(highlightId)) {
    ordered.push(highlightId);
    seen.add(highlightId);
  }
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    if (!users.find((u) => u.id === id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  if (ordered.length === 0) return null;

  const visible = ordered.slice(0, max);
  const overflow = ordered.length - visible.length;
  const overlap = size === "xs" ? "-ml-1.5" : "-ml-2";
  const ring = size === "xs" ? "ring-2" : "ring-2";
  const bubbleSz = size === "xs" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[10px]";

  return (
    <div className={cn("flex items-center", muted && "opacity-60", className)}>
      {visible.map((id, i) => (
        <div
          key={id}
          className={cn(
            i === 0 ? "" : overlap,
            "rounded-full",
            highlightId && id === highlightId && `${ring} ring-amber-500 ring-offset-1 ring-offset-background`,
          )}
        >
          <UserAvatar userId={id} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            overlap,
            "rounded-full bg-muted text-muted-foreground border border-background flex items-center justify-center font-medium",
            bubbleSz,
          )}
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

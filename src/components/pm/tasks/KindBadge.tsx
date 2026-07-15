import { cn } from "@/lib/utils";
import { KIND_META, type TaskKind } from "@/lib/pm/taskKind";

interface Props {
  kind: TaskKind;
  size?: "xs" | "sm";
  className?: string;
  /** When true, always render (even for plain "task"). Default: hide task. */
  showTask?: boolean;
}

export function KindBadge({ kind, size = "xs", className, showTask = false }: Props) {
  if (kind === "task" && !showTask) return null;
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const sz = size === "xs"
    ? "text-[10px] py-0 px-1.5 gap-1"
    : "text-[11px] py-0.5 px-2 gap-1.5";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wider shrink-0",
        meta.badgeClass,
        sz,
        className,
      )}
      title={meta.description}
    >
      <Icon className="h-3 w-3" />
      {meta.short}
    </span>
  );
}

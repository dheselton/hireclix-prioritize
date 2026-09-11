import { Flag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/pm";
import { getQaPriorityLabel, type TaskKind } from "@/lib/pm/taskKind";

const SIZE_CLASS: Record<"xs" | "sm" | "md", string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

// Inherits from existing semantic tokens (text-warning / text-destructive / text-muted-foreground)
const COLOR_CLASS: Record<TaskPriority, string> = {
  low: "text-muted-foreground/60",
  medium: "text-warning",
  high: "text-warning",
  urgent: "text-destructive",
};

const FILLED: Record<TaskPriority, boolean> = {
  low: false,
  medium: false,
  high: true,
  urgent: true,
};

const LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

interface Props {
  priority: TaskPriority | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
  /** When kind is qa, tooltip uses Pre Launch / Post-Launch labels. */
  kind?: TaskKind;
}

export function PriorityFlag({ priority, size = "sm", className, kind = "task" }: Props) {
  if (!priority) return null;
  const filled = FILLED[priority];
  const label = kind === "qa" ? getQaPriorityLabel(priority) : LABEL[priority];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={`Priority: ${label}`}
            className={cn("inline-flex items-center shrink-0", className)}
          >
            <Flag
              className={cn(
                SIZE_CLASS[size],
                COLOR_CLASS[priority],
                filled && "fill-current",
              )}
              strokeWidth={2.25}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">Priority: {label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

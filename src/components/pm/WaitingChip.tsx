import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function WaitingChip({ reason, className }: { reason: string | null; className?: string }) {
  return (
    <span
      title={reason ?? "Waiting"}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/40 bg-muted/40 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      <Clock className="h-2.5 w-2.5" />
      Waiting
    </span>
  );
}

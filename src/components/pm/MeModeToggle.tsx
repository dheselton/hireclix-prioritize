import { cn } from "@/lib/utils";
import { useMeMode } from "@/hooks/useMeMode";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MeModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useMeMode();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center rounded-md border border-border bg-background p-0.5 relative",
            mode === "me" && "ring-2 ring-primary/40",
            className,
          )}
          role="group"
          aria-label="Me or All filter"
        >
          <button
            type="button"
            onClick={() => setMode("me")}
            className={cn(
              "px-2.5 h-7 text-xs font-medium rounded transition-colors",
              mode === "me" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Me
          </button>
          <button
            type="button"
            onClick={() => setMode("all")}
            className={cn(
              "px-2.5 h-7 text-xs font-medium rounded transition-colors",
              mode === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            All
          </button>
          {mode === "me" && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">Press <kbd className="px-1 rounded bg-muted text-[10px]">M</kbd> to toggle</TooltipContent>
    </Tooltip>
  );
}

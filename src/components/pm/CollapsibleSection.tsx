import { ReactNode, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  title: string;
  count?: number;
  storageKey?: string;
  defaultOpen?: boolean;
  rightSlot?: ReactNode;
  children: ReactNode;
  accent?: "default" | "amber" | "red";
}

/**
 * Generic collapsible band used across the new Work Queue layout.
 * Open state persists per storageKey in localStorage.
 */
export function CollapsibleSection({
  id, title, count, storageKey, defaultOpen = true, rightSlot, children, accent = "default",
}: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    if (!storageKey) return defaultOpen;
    const v = window.localStorage.getItem(storageKey);
    if (v == null) return defaultOpen;
    return v === "1";
  });

  useEffect(() => {
    if (!storageKey) return;
    try { window.localStorage.setItem(storageKey, open ? "1" : "0"); } catch {}
  }, [open, storageKey]);

  const accentBorder =
    accent === "amber" ? "border-amber-400/40"
    : accent === "red" ? "border-red-500/40"
    : "border-border";

  return (
    <section id={id} className={cn("scroll-mt-24 rounded-lg border bg-card/40", accentBorder)}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          onClick={() => setOpen(v => !v)}
        >
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {title}
            {typeof count === "number" && (
              <span className="ml-2 text-foreground/50 normal-case font-normal">({count})</span>
            )}
          </h2>
        </button>
        {rightSlot}
      </div>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </section>
  );
}

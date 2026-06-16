import { cn } from "@/lib/utils";

interface Props {
  /** CSS background value (solid color or repeating-linear-gradient). */
  background: string | null;
  /** Render dimmed (waiting) — drops opacity. */
  dim?: boolean;
  className?: string;
}

/**
 * Absolutely-positioned left color bar inside a relatively-positioned card.
 * Parent card MUST have `relative` and `overflow-hidden` for clean rounded edges.
 */
export function TeamColorBar({ background, dim, className }: Props) {
  if (!background) return null;
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0 w-1 pointer-events-none", className)}
      style={{ background, opacity: dim ? 0.35 : 1 }}
    />
  );
}

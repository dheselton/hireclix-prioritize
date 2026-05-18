import { AlertTriangle, Ban } from "lucide-react";

export function BlockerBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
      <Ban className="h-4 w-4" /> This task is currently blocked.
    </div>
  );
}

export function BlockedByBanner({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 px-3 py-2 text-sm">
      <AlertTriangle className="h-4 w-4" />
      This task is blocked by {count} incomplete task{count === 1 ? "" : "s"}.
    </div>
  );
}

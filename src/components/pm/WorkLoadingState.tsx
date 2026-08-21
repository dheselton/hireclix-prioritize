import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function WorkListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-label="Loading work" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-md border border-border/60 bg-card p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[min(24rem,75%)]" />
              <Skeleton className="h-3 w-[min(18rem,55%)]" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Loading work" aria-busy="true">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkPageSkeleton() {
  return (
    <div className="page-shell space-y-4" aria-label="Loading tasks and projects" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <WorkListSkeleton />
    </div>
  );
}

export function SidebarWorkSkeleton() {
  return (
    <div className="space-y-2 px-2 py-1" aria-label="Loading assigned work" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className={cn("h-3", index === 1 ? "w-28" : "w-36")} />
        </div>
      ))}
    </div>
  );
}

export function WorkLoadError({ retry }: { retry?: () => void }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="font-medium text-destructive">Tasks and projects couldn’t be loaded.</div>
      {retry && (
        <button type="button" onClick={retry} className="mt-2 text-xs font-medium text-primary hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

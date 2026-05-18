import { TYPE_LABEL, useTypeFilter } from "@/hooks/useTypeFilter";

/**
 * Subtle context label below the toolbar that explains the implicit role-based
 * type filter and lets the user opt out for the current session.
 * Renders NOTHING when no type filter is active (e.g. PMs / Submitters see all).
 */
export function TypeFilterLabel({ page }: { page: string }) {
  const { types, isDefault, showAll, resetToDefault } = useTypeFilter(page);

  // No active filter → render nothing (PMs / Submitters see everything by default).
  if (types.size === 0) return null;

  const showing = `${[...types].map(t => TYPE_LABEL[t]).join(" + ").toLowerCase()} tasks`;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Showing {showing}</span>
      <span aria-hidden>·</span>
      <button type="button" className="underline hover:text-foreground" onClick={showAll}>
        Show all types
      </button>
      {!isDefault && (
        <button type="button" className="underline hover:text-foreground" onClick={resetToDefault}>
          Reset
        </button>
      )}
    </div>
  );
}

import { TYPE_LABEL, useTypeFilter } from "@/hooks/useTypeFilter";

/** Tiny label that explains the implicit role-based type filter and lets the user opt out. */
export function TypeFilterLabel({ page }: { page: string }) {
  const { types, isDefault, showAll, resetToDefault } = useTypeFilter(page);
  const showing =
    types.size === 0
      ? "All task types"
      : `${[...types].map(t => TYPE_LABEL[t]).join(" + ")} tasks`;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Showing: <span className="font-medium text-foreground">{showing}</span></span>
      {types.size > 0 && (
        <button type="button" className="underline hover:text-foreground" onClick={showAll}>
          Show all types
        </button>
      )}
      {!isDefault && (
        <button type="button" className="underline hover:text-foreground" onClick={resetToDefault}>
          Reset
        </button>
      )}
    </div>
  );
}

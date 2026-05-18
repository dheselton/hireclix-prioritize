import { useCallback, useEffect, useState } from "react";

export type WorkTypeFilter = "all" | "request" | "project";

const keyFor = (viewKey: string) => `pm.workTypeFilter.${viewKey}`;

/** Persistent All / Requests / Projects segmented filter. */
export function useWorkTypeFilter(viewKey: string) {
  const [value, setValue] = useState<WorkTypeFilter>(() => {
    if (typeof window === "undefined") return "all";
    const v = window.localStorage.getItem(keyFor(viewKey));
    return (v as WorkTypeFilter) || "all";
  });

  useEffect(() => {
    try { window.localStorage.setItem(keyFor(viewKey), value); } catch {}
  }, [viewKey, value]);

  const set = useCallback((v: WorkTypeFilter) => setValue(v), []);
  return { value, set };
}

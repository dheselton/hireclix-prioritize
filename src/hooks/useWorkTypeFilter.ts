import { useCallback, useEffect, useState } from "react";

export type WorkTypeFilter = "all" | "request" | "project";

const keyFor = (viewKey: string) => `pm.workTypeFilter.${viewKey}`;
const VALID = new Set<WorkTypeFilter>(["all", "request", "project"]);

/** Persistent All / Requests / Projects segmented filter. URL param `?workType=` wins on mount. */
export function useWorkTypeFilter(viewKey: string) {
  const [value, setValue] = useState<WorkTypeFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("workType");
      if (raw && VALID.has(raw as WorkTypeFilter)) {
        try { window.localStorage.setItem(keyFor(viewKey), raw); } catch {}
        params.delete("workType");
        const url = new URL(window.location.href);
        url.search = params.toString();
        window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
        return raw as WorkTypeFilter;
      }
    } catch {}
    const v = window.localStorage.getItem(keyFor(viewKey));
    return (v as WorkTypeFilter) || "all";
  });

  useEffect(() => {
    try { window.localStorage.setItem(keyFor(viewKey), value); } catch {}
  }, [viewKey, value]);

  const set = useCallback((v: WorkTypeFilter) => setValue(v), []);
  return { value, set };
}

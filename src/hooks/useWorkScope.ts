import { useCallback, useState } from "react";

export type WorkScope = "open" | "completed" | "all";

const VALID = new Set<WorkScope>(["open", "completed", "all"]);

/**
 * Open / Completed / All scope for current-work views.
 * Defaults to "open" and is NOT persisted — every visit starts on Open.
 * URL param `?scope=` wins on mount (deep-link), then is stripped.
 */
export function useWorkScope() {
  const [value, setValue] = useState<WorkScope>(() => {
    if (typeof window === "undefined") return "open";
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("scope");
      if (raw && VALID.has(raw as WorkScope)) {
        params.delete("scope");
        const url = new URL(window.location.href);
        url.search = params.toString();
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
        );
        return raw as WorkScope;
      }
    } catch { /* ignore */ }
    return "open";
  });

  const set = useCallback((v: WorkScope) => setValue(v), []);
  return { value, set };
}

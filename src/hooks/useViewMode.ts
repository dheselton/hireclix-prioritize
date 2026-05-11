import { useState, useEffect, useCallback } from "react";

export type ViewMode = "list" | "grid";

const KEY = (viewKey: string) => `pm.viewMode.${viewKey}`;

export function useViewMode(viewKey: string, defaultMode: ViewMode = "list") {
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const v = window.localStorage.getItem(KEY(viewKey));
    return (v === "list" || v === "grid") ? v : defaultMode;
  });

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try { window.localStorage.setItem(KEY(viewKey), m); } catch {}
  }, [viewKey]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY(viewKey) && (e.newValue === "list" || e.newValue === "grid")) {
        setModeState(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [viewKey]);

  return [mode, setMode] as const;
}

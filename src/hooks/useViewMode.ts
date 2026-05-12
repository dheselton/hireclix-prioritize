import { useState, useEffect, useCallback } from "react";

export type ViewMode = "list" | "grid" | "kanban";

const isMode = (v: any): v is ViewMode => v === "list" || v === "grid" || v === "kanban";

const KEY = (viewKey: string) => `pm.viewMode.${viewKey}`;
const DEFAULT_KEY = "pm.viewMode.default";

function readDefault(): ViewMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(DEFAULT_KEY);
  return isMode(v) ? v : null;
}

export function useViewMode(viewKey: string, fallback: ViewMode = "list") {
  const resolveInitial = (): ViewMode => {
    if (typeof window === "undefined") return fallback;
    const v = window.localStorage.getItem(KEY(viewKey));
    if (isMode(v)) return v;
    return readDefault() ?? fallback;
  };
  const [mode, setModeState] = useState<ViewMode>(resolveInitial);

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try { window.localStorage.setItem(KEY(viewKey), m); } catch {}
  }, [viewKey]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY(viewKey) && isMode(e.newValue)) {
        setModeState(e.newValue);
      }
      // If the global default changes and this view has no explicit value, pick it up.
      if (e.key === DEFAULT_KEY && isMode(e.newValue)) {
        const explicit = window.localStorage.getItem(KEY(viewKey));
        if (!isMode(explicit)) setModeState(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [viewKey]);

  return [mode, setMode] as const;
}

export function useDefaultViewMode() {
  const [def, setDefState] = useState<ViewMode>(() => readDefault() ?? "list");

  const setDefault = useCallback((m: ViewMode) => {
    setDefState(m);
    try { window.localStorage.setItem(DEFAULT_KEY, m); } catch {}
  }, []);

  const resetAll = useCallback(() => {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("pm.viewMode.") && k !== DEFAULT_KEY) toRemove.push(k);
      }
      toRemove.forEach(k => window.localStorage.removeItem(k));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === DEFAULT_KEY && isMode(e.newValue)) setDefState(e.newValue);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { defaultMode: def, setDefault, resetAll };
}

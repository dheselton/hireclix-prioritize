import { useState, useEffect, useCallback } from "react";

export type ViewMode = "list" | "grid" | "kanban" | "projects";

const isMode = (v: any): v is ViewMode => v === "list" || v === "grid" || v === "kanban" || v === "projects";

const KEY = (viewKey: string) => `pm.viewMode.${viewKey}`;
const DEFAULT_KEY = "pm.viewMode.default";

export type UseViewModeOptions = {
  /** When set, inherited/stored modes outside this set coerce to `fallback`. */
  allowed?: readonly ViewMode[];
};

function readDefault(): ViewMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(DEFAULT_KEY);
  return isMode(v) ? v : null;
}

function coerceMode(
  candidate: ViewMode | null | undefined,
  fallback: ViewMode,
  allowed?: readonly ViewMode[],
): ViewMode {
  if (!candidate || !isMode(candidate)) return fallback;
  if (allowed && allowed.length > 0 && !allowed.includes(candidate)) return fallback;
  return candidate;
}

function readRaw(viewKey: string): ViewMode | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(KEY(viewKey));
  if (isMode(stored)) return stored;
  return readDefault();
}

export function useViewMode(
  viewKey: string,
  fallback: ViewMode = "list",
  options?: UseViewModeOptions,
) {
  const allowed = options?.allowed;

  const [mode, setModeState] = useState<ViewMode>(() =>
    coerceMode(readRaw(viewKey), fallback, allowed),
  );

  // Persist when we had to coerce away from an unsupported inherited/stored mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(KEY(viewKey));
      const needsPersist =
        !isMode(stored) ||
        (allowed != null && allowed.length > 0 && !allowed.includes(stored));
      if (needsPersist) window.localStorage.setItem(KEY(viewKey), mode);
    } catch { /* ignore */ }
    // Intentionally only on mount / viewKey change — setMode persists user picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  const setMode = useCallback((m: ViewMode) => {
    const next = coerceMode(m, fallback, allowed);
    setModeState(next);
    try { window.localStorage.setItem(KEY(viewKey), next); } catch {}
  }, [viewKey, fallback, allowed]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY(viewKey) && isMode(e.newValue)) {
        setModeState(coerceMode(e.newValue, fallback, allowed));
      }
      // If the global default changes and this view has no explicit value, pick it up.
      if (e.key === DEFAULT_KEY && isMode(e.newValue)) {
        const explicit = window.localStorage.getItem(KEY(viewKey));
        if (!isMode(explicit)) setModeState(coerceMode(e.newValue, fallback, allowed));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [viewKey, fallback, allowed]);

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

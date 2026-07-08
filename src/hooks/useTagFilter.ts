import { useEffect, useState, useCallback } from "react";

const keyFor = (viewKey: string) => `pm.tagFilter.${viewKey}`;

/** Multi-select tag filter, persisted per view + URL param `tags=type:careersite,feature:seo`. */
export function useTagFilter(viewKey: string) {
  const [tags, setTags] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("tags");
      if (raw != null) {
        const arr = raw.split(",").map(s => s.trim()).filter(Boolean);
        try { localStorage.setItem(keyFor(viewKey), JSON.stringify(arr)); } catch {}
        params.delete("tags");
        const url = new URL(window.location.href);
        url.search = params.toString();
        window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
        return arr;
      }
    } catch {}
    try {
      const raw = localStorage.getItem(keyFor(viewKey));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(keyFor(viewKey), JSON.stringify(tags)); } catch {}
  }, [viewKey, tags]);

  const toggle = useCallback((t: string) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }, []);
  const clear = useCallback(() => setTags([]), []);
  return { tags, setTags, toggle, clear };
}

/** Return true iff a task's tags include every filter tag (AND). Empty filter = pass. */
export function taskMatchesTagFilter(taskTags: string[] | null | undefined, filter: string[]): boolean {
  if (!filter.length) return true;
  const set = new Set(taskTags ?? []);
  return filter.every(t => set.has(t));
}

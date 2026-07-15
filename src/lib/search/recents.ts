import type { SearchResult } from "./index";

const KEY = "lovable:pm:search:recents";
const MAX = 8;

export function getRecents(): SearchResult[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch { return []; }
}

export function pushRecent(r: SearchResult) {
  try {
    const cur = getRecents().filter(x => !(x.kind === r.kind && x.id === r.id));
    cur.unshift(r);
    localStorage.setItem(KEY, JSON.stringify(cur.slice(0, MAX)));
  } catch {}
}

export function clearRecents() {
  try { localStorage.removeItem(KEY); } catch {}
}

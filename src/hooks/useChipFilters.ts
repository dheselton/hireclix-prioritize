import { useEffect, useState, useCallback } from "react";

export type ChipId =
  | "assigned_to_me"
  | "created_by_me"
  | "watching"
  | "overdue"
  | "due_this_week"
  | "blocked";

export const ALL_CHIPS: { id: ChipId; label: string }[] = [
  { id: "assigned_to_me", label: "Assigned to me" },
  { id: "created_by_me", label: "Created by me" },
  { id: "watching", label: "Watching" },
  { id: "overdue", label: "Overdue" },
  { id: "due_this_week", label: "Due this week" },
  { id: "blocked", label: "Blocked" },
];

const keyFor = (viewKey: string) => `pm.filters.${viewKey}`;

export function useChipFilters(viewKey: string) {
  const [active, setActive] = useState<Set<ChipId>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(keyFor(viewKey));
      return new Set<ChipId>(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(keyFor(viewKey), JSON.stringify([...active])); } catch {}
  }, [viewKey, active]);

  const toggle = useCallback((id: ChipId) => {
    setActive(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);
  const clear = useCallback(() => setActive(new Set()), []);
  const isOn = useCallback((id: ChipId) => active.has(id), [active]);
  return { active, toggle, clear, isOn };
}

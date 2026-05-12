// Tiny pub/sub so drawer edits notify list/board/queue pages to refetch.
import { useEffect } from "react";

const subs = new Set<() => void>();

export function emitTasksChanged() {
  subs.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function useTasksChanged(handler: () => void) {
  useEffect(() => {
    subs.add(handler);
    return () => { subs.delete(handler); };
  }, [handler]);
}

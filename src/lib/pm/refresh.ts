// Tiny pub/sub so drawer edits notify list/board/queue pages to refetch.
import { useEffect, useRef } from "react";

const subs = new Set<() => void>();

export function emitTasksChanged() {
  subs.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function useTasksChanged(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = () => ref.current();
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
}

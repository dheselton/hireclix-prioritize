import { useEffect, useState, useCallback } from "react";

const KEY = "pm.trackMode";
export type TrackMode = "mine" | "other" | "all";

const subs = new Set<() => void>();
function read(): TrackMode {
  if (typeof window === "undefined") return "all";
  return (sessionStorage.getItem(KEY) as TrackMode) || "mine";
}
function write(v: TrackMode) {
  try { sessionStorage.setItem(KEY, v); } catch {}
  subs.forEach(fn => fn());
}

export function useTrackMode() {
  const [mode, setMode] = useState<TrackMode>(read);
  useEffect(() => {
    const fn = () => setMode(read());
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  const set = useCallback((v: TrackMode) => { write(v); }, []);
  return { mode, setMode: set };
}

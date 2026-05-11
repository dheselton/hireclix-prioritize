import { useEffect, useState, useCallback } from "react";

const KEY = "pm.meMode";
type MeMode = "me" | "all";

const subs = new Set<() => void>();
function read(): MeMode {
  if (typeof window === "undefined") return "all";
  return (sessionStorage.getItem(KEY) as MeMode) || "all";
}
function write(v: MeMode) {
  try { sessionStorage.setItem(KEY, v); } catch {}
  subs.forEach(fn => fn());
}

export function useMeMode() {
  const [mode, setMode] = useState<MeMode>(read);
  useEffect(() => {
    const fn = () => setMode(read());
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  const set = useCallback((v: MeMode) => { write(v); }, []);
  const toggle = useCallback(() => { write(read() === "me" ? "all" : "me"); }, []);
  return { mode, isMe: mode === "me", setMode: set, toggle };
}

let installed = false;
export function installMeModeHotkey() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t) {
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (t.isContentEditable) return;
    }
    e.preventDefault();
    write(read() === "me" ? "all" : "me");
  });
}

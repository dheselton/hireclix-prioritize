import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { GlobalSearchPanel } from "./search/GlobalSearchPanel";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full flex items-center gap-2 pl-10 pr-3 h-9 rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left truncate">Search projects, tasks, clients…</span>
        <kbd className="hidden md:inline-flex text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
      <GlobalSearchPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

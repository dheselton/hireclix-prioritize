import { useEffect, useRef, useState } from "react";
import { Search, Folder, CheckSquare, Building2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Result =
  | { kind: "project"; id: string; title: string; sub?: string }
  | { kind: "task"; id: string; title: string; sub?: string }
  | { kind: "client"; id: string; title: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        (wrapRef.current?.querySelector("input") as HTMLInputElement | null)?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${term}%`;
      const [projRes, taskRes, clientRes] = await Promise.all([
        supabase
          .from("pm_projects")
          .select("id,name,client_id")
          .ilike("name", like)
          .limit(6),
        supabase
          .from("pm_tasks")
          .select("id,title,project_id")
          .ilike("title", like)
          .limit(8),
        supabase.from("clients").select("id,name").ilike("name", like).limit(4),
      ]);

      const clientIds = new Set<string>();
      (projRes.data ?? []).forEach((p: any) => p.client_id && clientIds.add(p.client_id));
      const projectIds = new Set<string>();
      (taskRes.data ?? []).forEach((t: any) => t.project_id && projectIds.add(t.project_id));

      const [clientLookup, projectLookup] = await Promise.all([
        clientIds.size
          ? supabase.from("clients").select("id,name").in("id", Array.from(clientIds))
          : Promise.resolve({ data: [] as any[] }),
        projectIds.size
          ? supabase.from("pm_projects").select("id,name").in("id", Array.from(projectIds))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const clientMap = new Map<string, string>(
        (clientLookup.data ?? []).map((c: any) => [c.id, c.name]),
      );
      const projectMap = new Map<string, string>(
        (projectLookup.data ?? []).map((p: any) => [p.id, p.name]),
      );

      const out: Result[] = [
        ...(projRes.data ?? []).map((p: any) => ({
          kind: "project" as const,
          id: p.id,
          title: p.name,
          sub: p.client_id ? clientMap.get(p.client_id) : undefined,
        })),
        ...(taskRes.data ?? []).map((t: any) => ({
          kind: "task" as const,
          id: t.id,
          title: t.title,
          sub: t.project_id ? projectMap.get(t.project_id) : undefined,
        })),
        ...(clientRes.data ?? []).map((c: any) => ({
          kind: "client" as const,
          id: c.id,
          title: c.name,
        })),
      ];
      setResults(out);
      setActiveIdx(0);
      setLoading(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  function go(r: Result) {
    setOpen(false);
    setQ("");
    if (r.kind === "project") nav(`/pm/projects/${r.id}`);
    else if (r.kind === "task") nav(`/pm/tasks/${r.id}`);
    else nav(`/pm/work?client=${r.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      go(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search projects, tasks, clients…  (⌘K)"
        className="pl-10 bg-background"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">No results</div>
          )}
          {!loading && results.map((r, i) => {
            const Icon = r.kind === "project" ? Folder : r.kind === "task" ? CheckSquare : Building2;
            return (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => go(r)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                  i === activeIdx ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate">{r.title}</span>
                {r.sub && (
                  <span className="text-xs text-muted-foreground truncate max-w-[45%]">{r.sub}</span>
                )}
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 ml-2">
                  {r.kind}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

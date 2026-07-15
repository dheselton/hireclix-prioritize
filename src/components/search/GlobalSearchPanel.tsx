import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Folder, CheckSquare, Building2, Code2, FileText, User, Clock, X, CornerDownLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { runGlobalSearch, type SearchBundle, type SearchResult, type ResultKind } from "@/lib/search";
import { getRecents, pushRecent } from "@/lib/search/recents";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { SearchHighlight } from "./SearchHighlight";

const KIND_META: Record<ResultKind, { label: string; Icon: React.ComponentType<{ className?: string }>; group: string }> = {
  client:  { label: "Client",  Icon: Building2,   group: "Clients" },
  project: { label: "Project", Icon: Folder,      group: "Projects" },
  task:    { label: "Task",    Icon: CheckSquare, group: "Tasks" },
  snippet: { label: "Snippet", Icon: Code2,       group: "Snippets" },
  form:    { label: "Form",    Icon: FileText,    group: "Forms" },
  person:  { label: "Person",  Icon: User,        group: "People" },
};

const GROUP_ORDER: ResultKind[] = ["client", "project", "task", "snippet", "form", "person"];

export function GlobalSearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [bundle, setBundle] = useState<SearchBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const nav = useNavigate();
  const { user } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      setRecents(getRecents());
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQ("");
      setBundle(null);
      setActiveIdx(0);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setBundle(null); setLoading(false); return; }
    setLoading(true);
    const token = ++abortRef.current;
    const h = setTimeout(async () => {
      const b = await runGlobalSearch(q, { meId: user?.id ?? null });
      if (token !== abortRef.current) return;
      setBundle(b);
      setActiveIdx(0);
      setLoading(false);
    }, 180);
    return () => clearTimeout(h);
  }, [q, user?.id]);

  const flat: SearchResult[] = useMemo(() => {
    if (!bundle) return [];
    const out: SearchResult[] = [];
    for (const k of GROUP_ORDER) {
      const rows = bundle.groups[k] ?? [];
      out.push(...rows);
    }
    return out;
  }, [bundle]);

  const showRecents = !q.trim() && recents.length > 0;
  const navList = showRecents ? recents : flat;

  function go(r: SearchResult) {
    pushRecent(r);
    onClose();
    nav(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, navList.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && navList[activeIdx]) { e.preventDefault(); go(navList[activeIdx]); }
    else if (e.key === "Escape") { onClose(); }
  }

  if (!open) return null;

  const term = q.trim();
  const hasResults = flat.length > 0;

  let runningIdx = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, projects, tasks, snippets…  try c:  p:  t:  #tag  @user"
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-base"
          />
          {q && (
            <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => setQ("")} aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="p-4 space-y-2">
              {[0,1,2].map(i => <div key={i} className="h-9 rounded bg-muted animate-pulse" />)}
            </div>
          )}

          {!loading && showRecents && (
            <Section title="Recent" icon={<Clock className="h-3 w-3" />}>
              {recents.map((r, i) => (
                <ResultRow key={`recent-${r.kind}-${r.id}`} r={r} term="" active={i === activeIdx} onHover={() => setActiveIdx(i)} onClick={() => go(r)} />
              ))}
            </Section>
          )}

          {!loading && !showRecents && term.length >= 2 && !hasResults && (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-muted-foreground mb-3">No results for <span className="text-foreground font-medium">"{term}"</span></div>
              <div className="text-xs text-muted-foreground">Try scoping with <code className="bg-muted px-1 rounded">c:</code>, <code className="bg-muted px-1 rounded">p:</code>, <code className="bg-muted px-1 rounded">t:</code>, <code className="bg-muted px-1 rounded">#tag</code>, or <code className="bg-muted px-1 rounded">@user</code></div>
            </div>
          )}

          {!loading && !showRecents && hasResults && bundle && GROUP_ORDER.map(kind => {
            const rows = bundle.groups[kind] ?? [];
            if (!rows.length) return null;
            const total = bundle.totals[kind] ?? rows.length;
            const meta = KIND_META[kind];
            return (
              <Section key={kind} title={`${meta.group} (${total})`}>
                {rows.map((r) => {
                  const idx = runningIdx++;
                  return (
                    <ResultRow key={`${r.kind}-${r.id}`} r={r} term={term} active={idx === activeIdx}
                      onHover={() => setActiveIdx(idx)} onClick={() => go(r)} />
                  );
                })}
              </Section>
            );
          })}

          {term.length > 0 && term.length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">Keep typing…</div>
          )}

          {!term && !recents.length && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Start typing to search everything. Use <code className="bg-muted px-1 rounded">c:</code> <code className="bg-muted px-1 rounded">p:</code> <code className="bg-muted px-1 rounded">t:</code> <code className="bg-muted px-1 rounded">#tag</code> <code className="bg-muted px-1 rounded">@user</code> to scope.
            </div>
          )}
        </div>

        <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><kbd className="border border-border rounded px-1">↑↓</kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><kbd className="border border-border rounded px-1"><CornerDownLeft className="h-2.5 w-2.5" /></kbd> open</span>
          <span className="inline-flex items-center gap-1"><kbd className="border border-border rounded px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}{title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultRow({ r, term, active, onHover, onClick }: {
  r: SearchResult; term: string; active: boolean; onHover: () => void; onClick: () => void;
}) {
  const { Icon, label } = KIND_META[r.kind];
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-sm text-left",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="truncate">
          <SearchHighlight text={r.title} term={term} />
        </div>
        {r.sub && (
          <div className="text-xs text-muted-foreground truncate">
            <SearchHighlight text={r.sub} term={term} />
          </div>
        )}
      </div>
      {r.meta && <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{r.meta}</span>}
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 ml-1">{label}</span>
    </button>
  );
}

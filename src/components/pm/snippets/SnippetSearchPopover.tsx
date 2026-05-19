import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSnippets, fetchCategories, type Snippet, type SnippetCategory } from "@/lib/pm/snippets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedSnippetIds: string[];
  onToggle: (snippetId: string, willLink: boolean) => void | Promise<void>;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

let cachedSnippets: Snippet[] | null = null;
let cachedCategories: SnippetCategory[] | null = null;

export function SnippetSearchPopover({
  open,
  onOpenChange,
  linkedSnippetIds,
  onToggle,
  children,
  align = "start",
}: Props) {
  const [snippets, setSnippets] = useState<Snippet[]>(cachedSnippets ?? []);
  const [categories, setCategories] = useState<SnippetCategory[]>(cachedCategories ?? []);
  const [loading, setLoading] = useState(!cachedSnippets);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || cachedSnippets) return;
    setLoading(true);
    Promise.all([fetchSnippets(), fetchCategories()])
      .then(([s, c]) => {
        cachedSnippets = s;
        cachedCategories = c;
        setSnippets(s);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories],
  );

  const linkedSet = useMemo(() => new Set(linkedSnippetIds), [linkedSnippetIds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snippets.filter(s => {
      if (categoryId && s.category_id !== categoryId) return false;
      if (!q) return true;
      const cat = s.category_id ? categoryById.get(s.category_id)?.name ?? "" : "";
      return (
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [snippets, query, categoryId, categoryById]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[420px] p-0 z-50 bg-popover"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search snippets by title, tag, category…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border",
                  categoryId === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted/40",
                )}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border",
                    categoryId === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground italic">No snippets match.</div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map(s => {
                const linked = linkedSet.has(s.id);
                const cat = s.category_id ? categoryById.get(s.category_id) : null;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(s.id, !linked)}
                      className={cn(
                        "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition",
                        linked && "bg-muted/30",
                      )}
                    >
                      <div className="w-4 flex justify-center shrink-0">
                        {linked && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {cat && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {cat.name}
                            </Badge>
                          )}
                          {s.language && (
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {s.language}
                            </span>
                          )}
                          {s.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[10px] text-muted-foreground">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

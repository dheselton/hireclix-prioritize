import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle, Code, LayoutGrid, List, Plus, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/pm/mockUser";
import {
  createSnippet,
  deleteSnippet,
  duplicateSnippet,
  fetchCategories,
  fetchSnippets,
  updateSnippet,
  type Snippet,
  type SnippetCategory,
} from "@/lib/pm/snippets";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SnippetCard } from "@/components/pm/snippets/SnippetCard";
import { SnippetRow } from "@/components/pm/snippets/SnippetRow";
import { SnippetEditorDialog } from "@/components/pm/snippets/SnippetEditorDialog";
import { ManageCategoriesDialog } from "@/components/pm/snippets/ManageCategoriesDialog";
import { IncidentsTab } from "@/components/pm/snippets/IncidentsTab";
import { useViewMode } from "@/hooks/useViewMode";

type SortKey = "newest" | "az" | "used";

export default function Snippets() {
  const { role } = useCurrentUser();
  const allowed = role === "developer" || role === "designer";

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [categories, setCategories] = useState<SnippetCategory[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useViewMode("snippets", "grid");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const reload = async () => {
    const [s, c] = await Promise.all([fetchSnippets(), fetchCategories()]);
    setSnippets(s);
    setCategories(c);
  };

  useEffect(() => {
    if (!allowed) return;
    reload();
    supabase
      .from("pm_projects")
      .select("id,title")
      .order("title")
      .then(({ data }) => setProjects((data ?? []) as any));
  }, [allowed]);

  if (!allowed) return <Navigate to="/pm" replace />;

  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories],
  );
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    snippets.forEach(s => {
      if (s.category_id) m[s.category_id] = (m[s.category_id] ?? 0) + 1;
    });
    return m;
  }, [snippets]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach(s => s.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = snippets.filter(s => {
      if (activeCategory !== "all" && s.category_id !== activeCategory) return false;
      if (activeTags.length && !activeTags.every(t => s.tags.includes(t))) return false;
      if (q) {
        const hay = `${s.title} ${s.description ?? ""} ${s.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "used")
      list = [...list].sort((a, b) => b.project_ids.length - a.project_ids.length);
    else list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [snippets, search, activeCategory, activeTags, sort]);

  const handleDelete = async (s: Snippet) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    await deleteSnippet(s.id);
    reload();
  };

  const handleDuplicate = async (s: Snippet) => {
    await duplicateSnippet(s);
    reload();
  };

  const toggleTag = (t: string) =>
    setActiveTags(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]));

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-medium flex items-center gap-2">
            <Code className="h-5 w-5 text-info" /> Snippets
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Reusable code for Webflow, JS, CSS, and more
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          className="gap-1"
        >
          <Plus className="h-4 w-4" /> New Snippet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search snippets..."
              className="pl-8 h-9"
            />
          </div>

          <div>
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded text-sm border-l-[3px]",
                activeCategory === "all"
                  ? "border-info text-info bg-accent/40 font-medium"
                  : "border-transparent text-foreground hover:bg-accent/40",
              )}
            >
              <span>All Snippets</span>
              <span className="text-xs text-muted-foreground">{snippets.length}</span>
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 rounded text-sm border-l-[3px]",
                  activeCategory === c.id
                    ? "border-info text-info bg-accent/40 font-medium"
                    : "border-transparent text-foreground hover:bg-accent/40",
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{categoryCounts[c.id] ?? 0}</span>
              </button>
            ))}
            <button
              onClick={() => setManageOpen(true)}
              className="mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Manage Categories
            </button>
          </div>

          {allTags.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Filter by Tag
              </div>
              <div className="flex flex-wrap gap-1">
                {allTags.map(t => {
                  const active = activeTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={cn(
                        "text-[11px] px-1.5 py-0.5 rounded border transition-colors",
                        active
                          ? "bg-info text-info-foreground border-info"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              Showing {filtered.length} snippet{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="az">A–Z</SelectItem>
                  <SelectItem value="used">Most Used</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setView("grid")}
                  className={cn(
                    "px-2 py-1.5",
                    view === "grid" ? "bg-accent text-foreground" : "text-muted-foreground",
                  )}
                  title="Grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={cn(
                    "px-2 py-1.5",
                    view === "list" ? "bg-accent text-foreground" : "text-muted-foreground",
                  )}
                  title="List"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground text-sm">
              No snippets match your filters.
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {filtered.map(s => (
                <SnippetCard
                  key={s.id}
                  snippet={s}
                  category={s.category_id ? categoryById.get(s.category_id) : undefined}
                  onEdit={() => {
                    setEditing(s);
                    setEditorOpen(true);
                  }}
                  onDuplicate={() => handleDuplicate(s)}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <SnippetRow
                  key={s.id}
                  snippet={s}
                  category={s.category_id ? categoryById.get(s.category_id) : undefined}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <SnippetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        categories={categories}
        allTags={allTags}
        projects={projects}
        onSave={async input => {
          if (editing) await updateSnippet(editing.id, input);
          else await createSnippet(input);
          await reload();
        }}
      />

      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        categories={categories}
        counts={categoryCounts}
        onChanged={reload}
      />
    </div>
  );
}

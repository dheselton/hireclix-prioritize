import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagPill } from "./TagPill";
import { useTagCatalog, createCatalogEntry, parseTag, type CatalogEntry, type TagNamespace } from "@/lib/pm/tags";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  /** All tags (inherited + editable). Inherited (client:/type:) show as read-only chips when readOnlyInherited=true. */
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, client: and type: tags render read-only and can't be added/removed here. */
  readOnlyInherited?: boolean;
  /** Which namespaces the picker lets users add/toggle. Defaults to ['feature','type']. */
  editableNamespaces?: Array<"type" | "feature">;
  /** Allow inline "+ New ___" catalog additions. */
  allowAdd?: boolean;
  className?: string;
  placeholder?: string;
}

export function TagPicker({
  value,
  onChange,
  readOnlyInherited = false,
  editableNamespaces = ["feature", "type"],
  allowAdd = true,
  className,
  placeholder = "Add tag",
}: Props) {
  const { entries, reload } = useTagCatalog();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = new Set(value);

  const inherited = value.filter(t => {
    const p = parseTag(t);
    return readOnlyInherited && (p.namespace === "client" || p.namespace === "type");
  });
  const editable = value.filter(t => {
    const p = parseTag(t);
    if (!p.namespace) return false;
    if (readOnlyInherited && (p.namespace === "client" || p.namespace === "type")) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const filter = (e: CatalogEntry) =>
      !q || e.label.toLowerCase().includes(q.toLowerCase()) || e.slug.includes(q.toLowerCase());
    const g: Record<"type" | "feature", CatalogEntry[]> = { type: [], feature: [] };
    for (const e of entries) if (editableNamespaces.includes(e.namespace) && filter(e)) g[e.namespace].push(e);
    return g;
  }, [entries, q, editableNamespaces]);

  function toggle(ns: TagNamespace, slug: string) {
    const raw = `${ns}:${slug}`;
    if (selected.has(raw)) onChange(value.filter(t => t !== raw));
    else onChange([...value, raw]);
  }

  async function addNew(ns: "type" | "feature") {
    const label = q.trim();
    if (!label) return;
    try {
      const raw = await createCatalogEntry(ns, label);
      await reload();
      if (!selected.has(raw)) onChange([...value, raw]);
      setQ("");
      toast.success(`Added ${ns} tag "${label}"`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add tag");
    }
  }

  const noMatches = editableNamespaces.every(ns => grouped[ns].length === 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {inherited.map(t => <TagPill key={t} tag={t} catalog={entries} />)}
      {editable.map(t => (
        <TagPill
          key={t}
          tag={t}
          catalog={entries}
          onRemove={() => onChange(value.filter(x => x !== t))}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs">
            <Plus className="h-3 w-3 mr-1" /> {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0 z-50 bg-popover">
          <div className="p-2 border-b flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search or create..."
              className="h-7 border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {editableNamespaces.map(ns => (
              <div key={ns}>
                {grouped[ns].length > 0 && (
                  <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {ns === "type" ? "Type" : "Feature"}
                  </div>
                )}
                {grouped[ns].map(e => {
                  const raw = `${ns}:${e.slug}`;
                  const on = selected.has(raw);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggle(ns, e.slug)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between gap-2",
                        on && "bg-muted",
                      )}
                    >
                      <TagPill tag={raw} catalog={entries} />
                      {on && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
            {q && allowAdd && (
              <div className="border-t mt-1 pt-1">
                {editableNamespaces.map(ns => (
                  <button
                    key={ns}
                    type="button"
                    onClick={() => addNew(ns)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Create <b className="capitalize">{ns}</b> tag "{q}"
                  </button>
                ))}
              </div>
            )}
            {noMatches && !q && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">No tags yet</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

import { useMemo } from "react";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTagCatalog, type CatalogEntry } from "@/lib/pm/tags";
import { TagPill } from "@/components/pm/tags/TagPill";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  /** Optional extra tags currently in-use on visible tasks (e.g. client:*) so users can filter by them. */
  extraTags?: string[];
}

/** Toolbar-style filter chip that opens a grouped tag list (client / type / feature). */
export function TagFilterChip({ value, onToggle, onClear, extraTags = [] }: Props) {
  const { entries } = useTagCatalog();

  const groups = useMemo(() => {
    const clientSlugs = new Set<string>();
    for (const t of extraTags) if (t.startsWith("client:")) clientSlugs.add(t.slice("client:".length));
    const clientEntries: CatalogEntry[] = [...clientSlugs].map(slug => ({
      id: `client-${slug}`, namespace: "type" /* placeholder */, slug, label: titleCase(slug), color: null,
    })).sort((a, b) => a.label.localeCompare(b.label));

    const byNs = { type: [] as CatalogEntry[], feature: [] as CatalogEntry[] };
    for (const e of entries) byNs[e.namespace].push(e);
    return { client: clientEntries, type: byNs.type, feature: byNs.feature };
  }, [entries, extraTags]);

  const selected = new Set(value);
  const count = value.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1", count > 0 && "border-primary text-primary")}
        >
          <Tag className="h-3.5 w-3.5" />
          Tags{count > 0 ? ` (${count})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 z-50 bg-popover">
        <div className="flex items-center justify-between p-2 border-b">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter by tag</span>
          {count > 0 && (
            <button onClick={onClear} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          <Section label="Client" items={groups.client.map(e => ({ raw: `client:${e.slug}`, label: e.label }))} selected={selected} onToggle={onToggle} />
          <Section label="Type" items={groups.type.map(e => ({ raw: `type:${e.slug}`, label: e.label }))} selected={selected} onToggle={onToggle} />
          <Section label="Feature" items={groups.feature.map(e => ({ raw: `feature:${e.slug}`, label: e.label }))} selected={selected} onToggle={onToggle} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label, items, selected, onToggle }: { label: string; items: { raw: string; label: string }[]; selected: Set<string>; onToggle: (t: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      {items.map(it => {
        const on = selected.has(it.raw);
        return (
          <button
            key={it.raw}
            type="button"
            onClick={() => onToggle(it.raw)}
            className={cn("w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between gap-2", on && "bg-muted")}
          >
            <TagPill tag={it.raw} />
            {on && <span className="text-primary text-[10px]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function titleCase(s: string) {
  return s.split(/[-_ ]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}

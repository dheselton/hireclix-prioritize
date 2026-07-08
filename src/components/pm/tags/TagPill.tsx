import { cn } from "@/lib/utils";
import { parseTag, tagLabel, type CatalogEntry } from "@/lib/pm/tags";

interface Props {
  tag: string;
  catalog?: CatalogEntry[];
  onRemove?: () => void;
  className?: string;
  size?: "xs" | "sm";
  interactive?: boolean;
}

const NS_STYLES: Record<string, string> = {
  client:  "bg-muted text-muted-foreground border-border",
  type:    "bg-primary/10 text-primary border-primary/30",
  feature: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
};

export function TagPill({ tag, catalog, onRemove, className, size = "xs", interactive }: Props) {
  const p = parseTag(tag);
  const ns = p.namespace ?? "feature";
  const label = tagLabel(tag, catalog);
  const cls = NS_STYLES[ns] ?? NS_STYLES.feature;
  const sizeCls = size === "xs" ? "text-[10px] px-1.5 h-4" : "text-[11px] px-2 h-5";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap leading-none",
        cls, sizeCls, interactive && "cursor-pointer hover:opacity-80", className,
      )}
      title={`${ns}: ${label}`}
    >
      <span className="opacity-60">{ns === "client" ? "@" : ns === "type" ? "◆" : "#"}</span>
      <span className="truncate max-w-[120px]">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-60 hover:opacity-100"
          aria-label={`Remove ${label}`}
        >×</button>
      )}
    </span>
  );
}

/** Compact list with overflow. */
export function TagPillList({ tags, max = 3, catalog }: { tags: string[]; max?: number; catalog?: CatalogEntry[] }) {
  const visible = tags.filter(t => {
    const p = parseTag(t);
    return p.namespace !== null;
  });
  if (visible.length === 0) return null;
  const shown = visible.slice(0, max);
  const rest = visible.length - shown.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map(t => <TagPill key={t} tag={t} catalog={catalog} />)}
      {rest > 0 && (
        <span className="text-[10px] text-muted-foreground" title={visible.slice(max).join(", ")}>
          +{rest}
        </span>
      )}
    </div>
  );
}

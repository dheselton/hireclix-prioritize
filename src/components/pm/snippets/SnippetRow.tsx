import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";
import type { Snippet, SnippetCategory } from "@/lib/pm/snippets";

interface Props {
  snippet: Snippet;
  category?: SnippetCategory;
}

export function SnippetRow({ snippet, category }: Props) {
  const [open, setOpen] = useState(false);
  const [activeVar, setActiveVar] = useState(0);
  const [copied, setCopied] = useState(false);

  const variation = snippet.variations[activeVar] ?? snippet.variations[0];
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!variation) return;
    await navigator.clipboard.writeText(variation.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const catStyle = category?.color
    ? { background: `hsl(${category.color} / 0.15)`, color: `hsl(${category.color})` }
    : undefined;

  return (
    <div className="border border-border rounded-md bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="text-[14px] font-medium truncate flex-1">{snippet.title}</span>
        {category && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
            style={catStyle ?? { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
          >
            {category.name}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground truncate hidden md:inline max-w-[180px]">
          {snippet.tags.slice(0, 3).join(", ")}
        </span>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
          {snippet.language || "txt"}
        </span>
        <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </Button>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
          {snippet.description && (
            <p className="text-[13px] text-muted-foreground">{snippet.description}</p>
          )}
          {snippet.variations.length > 1 && (
            <div className="flex gap-1 p-0.5 rounded-md bg-muted w-fit">
              {snippet.variations.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVar(i)}
                  className={cn(
                    "text-[12px] px-2 py-1 rounded whitespace-nowrap",
                    i === activeVar
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
          {variation && <CodeBlock code={variation.code} language={snippet.language} />}
        </div>
      )}
    </div>
  );
}

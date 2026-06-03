import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, MoreHorizontal, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";
import { SnippetUsageFooter } from "./SnippetUsageFooter";
import type { Snippet, SnippetCategory } from "@/lib/pm/snippets";

interface Props {
  snippet: Snippet;
  category?: SnippetCategory;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SnippetCard({ snippet, category, onEdit, onDuplicate, onDelete }: Props) {
  const [activeVar, setActiveVar] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const variation = snippet.variations[activeVar] ?? snippet.variations[0];
  const tagsVisible = showAllTags ? snippet.tags : snippet.tags.slice(0, 4);
  const tagOverflow = snippet.tags.length - 4;
  const isLoom = !!snippet.video_url && /loom\.com/i.test(snippet.video_url);
  const videoLabel = isLoom ? "Watch Loom" : "Watch video";

  const handleCopy = async () => {
    if (!variation) return;
    try {
      await navigator.clipboard.writeText(variation.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const catStyle = category?.color
    ? { background: `hsl(${category.color} / 0.15)`, color: `hsl(${category.color})` }
    : undefined;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-medium truncate">{snippet.title}</h3>
        </div>
        {snippet.video_url && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-7 px-2 gap-1 text-[12px]"
          >
            <a href={snippet.video_url} target="_blank" rel="noreferrer">
              <Video className="h-3.5 w-3.5" />
              {videoLabel}
            </a>
          </Button>
        )}
        {category && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
            style={catStyle ?? { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
          >
            {category.name}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {snippet.description && (
        <p className="text-[13px] text-muted-foreground line-clamp-3">{snippet.description}</p>
      )}

      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tagsVisible.map(t => (
            <span
              key={t}
              className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {!showAllTags && tagOverflow > 0 && (
            <button
              onClick={() => setShowAllTags(true)}
              className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent"
            >
              +{tagOverflow} more
            </button>
          )}
        </div>
      )}

      {snippet.instructions && (
        <div className="rounded-md border border-border bg-muted/50">
          <button
            onClick={() => setShowInstructions(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <span>Instructions</span>
            {showInstructions ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {showInstructions && (
            <div className="px-3 pb-3 text-[13px] text-muted-foreground whitespace-pre-wrap">
              {snippet.instructions}
            </div>
          )}
        </div>
      )}

      {snippet.variations.length > 1 && (
        <div className="flex gap-1 p-0.5 rounded-md bg-muted w-fit max-w-full overflow-x-auto">
          {snippet.variations.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActiveVar(i)}
              className={cn(
                "text-[12px] px-2 py-1 rounded whitespace-nowrap transition-colors",
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

      <div className="flex items-center justify-between pt-1">
        <SnippetUsageFooter snippetId={snippet.id} />
        <Button size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy Code
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

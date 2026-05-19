import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { loadHighlightJs, normalizeLang } from "./highlight";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
  language?: string | null;
  collapsible?: boolean;
  initialLines?: number;
  className?: string;
}

export function CodeBlock({
  code,
  language,
  collapsible = true,
  initialLines = 8,
  className,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const lang = normalizeLang(language);
  const lineCount = code.split("\n").length;
  const showToggle = collapsible && lineCount > initialLines;

  useEffect(() => {
    let cancelled = false;
    loadHighlightJs().then(hljs => {
      if (cancelled || !ref.current || !hljs) return;
      ref.current.removeAttribute("data-highlighted");
      try {
        const result = hljs.highlight(code, { language: lang, ignoreIllegals: true });
        ref.current.innerHTML = result.value;
      } catch {
        ref.current.textContent = code;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const maxHeight = expanded ? "none" : `${initialLines * 1.5}em`;

  return (
    <div
      className={cn(
        "relative rounded-md overflow-hidden border border-border",
        className,
      )}
      style={{ background: "hsl(var(--code-bg))" }}
    >
      <div className="absolute top-2 right-2 z-10 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-black/40 text-white/80 font-mono">
        {(language || "txt").toUpperCase()}
      </div>
      <pre
        className="m-0 p-3 pt-7 overflow-auto text-xs leading-[1.5em]"
        style={{ maxHeight, transition: "max-height 0.2s" }}
      >
        <code ref={ref} className={`hljs language-${lang} font-mono`}>
          {code}
        </code>
      </pre>
      {!expanded && showToggle && (
        <div
          className="pointer-events-none absolute bottom-7 left-0 right-0 h-8"
          style={{
            background:
              "linear-gradient(to bottom, transparent, hsl(var(--code-bg)))",
          }}
        />
      )}
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1 py-1 text-[11px] text-white/70 hover:text-white bg-black/30 hover:bg-black/40 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

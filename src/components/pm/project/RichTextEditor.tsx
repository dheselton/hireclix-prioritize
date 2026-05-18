import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}

/** Minimal contentEditable rich-text editor. No external dependency. */
export function RichTextEditor({ value, onChange, onBlur, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Initialize / sync incoming value (only when not focused, to avoid caret jumps).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  function cmd(c: string, arg?: string) {
    document.execCommand(c, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML || "");
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    cmd("createLink", url);
  }

  return (
    <div className="border border-border rounded-md bg-background">
      <div className="flex items-center gap-0.5 border-b border-border px-1 py-1">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => cmd("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => cmd("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => cmd("insertUnorderedList")}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={() => cmd("insertOrderedList")}>
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => e.preventDefault()} onClick={addLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
        onBlur={onBlur}
        className="min-h-[96px] p-3 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
      />
    </div>
  );
}

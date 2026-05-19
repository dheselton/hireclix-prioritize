import { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MockUser } from "@/types/pm";

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  users?: MockUser[];
}

/** Minimal contentEditable rich-text editor. Optional @mentions when `users` provided. */
export function RichTextEditor({ value, onChange, onBlur, placeholder, users }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<{ filter: string; top: number; left: number } | null>(null);

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

  function handleInput() {
    onChange(ref.current?.innerHTML || "");
    if (!users) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) { setMention(null); return; }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) { setMention(null); return; }
    const text = node.textContent || "";
    const before = text.slice(0, range.startOffset);
    const m = before.match(/@([\w-]*)$/);
    if (!m) { setMention(null); return; }
    const rect = range.getBoundingClientRect();
    const host = ref.current.getBoundingClientRect();
    setMention({
      filter: m[1].toLowerCase(),
      top: rect.bottom - host.top + 4,
      left: rect.left - host.left,
    });
  }

  function pickMention(u: MockUser) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent || "";
    const before = text.slice(0, range.startOffset);
    const after = text.slice(range.startOffset);
    const m = before.match(/@([\w-]*)$/);
    if (!m) return;
    const first = u.name.split(" ")[0];
    const newBefore = before.slice(0, before.length - m[0].length);
    node.textContent = newBefore + after;
    // place caret where the @ was
    const newRange = document.createRange();
    newRange.setStart(node, newBefore.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    const span = document.createElement("span");
    span.className = "text-primary bg-primary/10 rounded px-1";
    span.setAttribute("data-mention-id", u.id);
    span.textContent = `@${first}`;
    newRange.insertNode(span);
    // insert trailing space + move caret after it
    const spaceNode = document.createTextNode("\u00A0");
    span.after(spaceNode);
    const afterRange = document.createRange();
    afterRange.setStart(spaceNode, 1);
    afterRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(afterRange);

    setMention(null);
    onChange(ref.current?.innerHTML || "");
    ref.current?.focus();
  }

  const suggestions = users && mention
    ? users.filter(u => u.name.toLowerCase().includes(mention.filter)).slice(0, 6)
    : [];

  return (
    <div className="border border-border rounded-md bg-background relative">
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
        onInput={handleInput}
        onKeyUp={handleInput}
        onBlur={e => {
          // Don't blur if clicking a mention suggestion
          if ((e.relatedTarget as HTMLElement)?.dataset?.mentionPick) return;
          setMention(null);
          onBlur?.();
        }}
        className="min-h-[96px] p-3 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
      />
      {users && mention && suggestions.length > 0 && (
        <div
          className="absolute z-50 bg-popover border border-border rounded shadow-md overflow-hidden min-w-[180px]"
          style={{ top: mention.top + 40, left: mention.left + 12 }}
        >
          {suggestions.map(u => (
            <button
              key={u.id}
              type="button"
              data-mention-pick="1"
              onMouseDown={e => { e.preventDefault(); pickMention(u); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
            >
              <span className="font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{u.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

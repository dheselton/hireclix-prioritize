import { useRef, useState, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { MockUser } from "@/types/pm";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  users: MockUser[];
  onMentionsChange?: (ids: string[]) => void;
  placeholder?: string;
  rows?: number;
}

/** Detects `@token` strings and emits matching user IDs on submit / change. */
export function MentionTextarea({ value, onChange, onSubmit, users, onMentionsChange, placeholder, rows = 3 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showSug, setShowSug] = useState(false);
  const [filter, setFilter] = useState("");

  function updateMentions(text: string) {
    const matches = Array.from(text.matchAll(/@([\w-]+)/g)).map(m => m[1].toLowerCase());
    const ids = users
      .filter(u => matches.some(m => u.name.toLowerCase().split(" ")[0] === m || u.name.toLowerCase().replace(/\s+/g, "") === m))
      .map(u => u.id);
    onMentionsChange?.(Array.from(new Set(ids)));
  }

  function handleChange(v: string) {
    onChange(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\w-]*)$/);
    if (m) { setFilter(m[1].toLowerCase()); setShowSug(true); } else setShowSug(false);
    updateMentions(v);
  }

  function pick(u: MockUser) {
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\w-]*)$/, `@${u.name.split(" ")[0]} `);
    const after = value.slice(caret);
    const next = before + after;
    onChange(next);
    setShowSug(false);
    updateMentions(next);
    requestAnimationFrame(() => ref.current?.focus());
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  const suggestions = users.filter(u => u.name.toLowerCase().includes(filter)).slice(0, 6);

  return (
    <div className="relative">
      <Textarea ref={ref} rows={rows} value={value} placeholder={placeholder}
        onChange={e => handleChange(e.target.value)} onKeyDown={onKey} />
      {showSug && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 left-0 right-0 max-w-xs bg-popover border border-border rounded shadow-md overflow-hidden">
          {suggestions.map(u => (
            <button key={u.id} type="button" onClick={() => pick(u)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted">
              <span className="font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{u.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render text with @firstname tokens highlighted. */
export function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[\w-]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@")
          ? <span key={i} className="text-primary bg-primary/10 rounded px-1 py-0.5">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

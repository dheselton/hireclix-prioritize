import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MockUser } from "@/types/pm";
import { sanitizeHtml } from "@/lib/pm/sanitizeHtml";

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  users?: MockUser[];
}

const CONTENT_CLASS =
  "min-h-[96px] p-3 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline";

type MentionState = { top: number; left: number; items: MockUser[]; command: (attrs: { id: string; label: string }) => void } | null;

/**
 * Rich-text editor backed by Tiptap (ProseMirror).
 *
 * Replaces the previous `document.execCommand` implementation. Command mapping:
 *   bold                -> toggleBold()
 *   italic              -> toggleItalic()
 *   insertUnorderedList -> toggleBulletList()
 *   insertOrderedList   -> toggleOrderedList()
 *   createLink          -> setLink({ href })
 *
 * Saved output stays sanitized HTML; mentions keep the
 * `<span data-mention-id="…">@First</span>` markup contract.
 */
export function RichTextEditor({ value, onChange, onBlur, placeholder, users }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<MentionState>(null);
  const usersRef = useRef<MockUser[] | undefined>(users);
  usersRef.current = users;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const extensions = useMemo(() => {
    const list: any[] = [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: placeholder || "" }),
    ];
    if (users) {
      list.push(
        Mention.configure({
          HTMLAttributes: { class: "text-primary bg-primary/10 rounded px-1" },
          renderHTML({ options, node }) {
            return [
              "span",
              { ...options.HTMLAttributes, "data-mention-id": node.attrs.id },
              `@${node.attrs.label ?? node.attrs.id}`,
            ];
          },
          renderText({ node }) {
            return `@${node.attrs.label ?? node.attrs.id}`;
          },
          suggestion: {
            char: "@",
            items: ({ query }: { query: string }) =>
              (usersRef.current || [])
                .filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 6),
            render: () => {
              const place = (props: any) => {
                const rect = props.clientRect?.();
                const host = hostRef.current?.getBoundingClientRect();
                if (!rect || !host) return;
                setMention({
                  top: rect.bottom - host.top + 4,
                  left: rect.left - host.left,
                  items: props.items,
                  command: props.command,
                });
              };
              return {
                onStart: place,
                onUpdate: place,
                onKeyDown: (props: any) => {
                  if (props.event.key === "Escape") {
                    setMention(null);
                    return true;
                  }
                  return false;
                },
                onExit: () => setMention(null),
              };
            },
          },
        }),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder, !!users]);

  const editor = useEditor(
    {
      extensions,
      content: sanitizeHtml(value),
      editorProps: { attributes: { class: CONTENT_CLASS } },
      onUpdate: ({ editor }) => onChangeRef.current(sanitizeHtml(editor.getHTML())),
      onBlur: () => onBlurRef.current?.(),
    },
    [extensions],
  );

  // Sync external value changes, but never while the user is typing.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const clean = sanitizeHtml(value);
    if (editor.getHTML() !== clean) editor.commands.setContent(clean, { emitUpdate: false });
  }, [value, editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Link URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const tools: { key: string; icon: typeof Bold; active: string; run: (e: Editor) => void }[] = [
    { key: "bold", icon: Bold, active: "bold", run: e => e.chain().focus().toggleBold().run() },
    { key: "italic", icon: Italic, active: "italic", run: e => e.chain().focus().toggleItalic().run() },
    { key: "bulletList", icon: List, active: "bulletList", run: e => e.chain().focus().toggleBulletList().run() },
    { key: "orderedList", icon: ListOrdered, active: "orderedList", run: e => e.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div ref={hostRef} className="border border-border rounded-md bg-background relative">
      <div className="flex items-center gap-0.5 border-b border-border px-1 py-1">
        {tools.map(t => (
          <Button
            key={t.key}
            type="button"
            size="icon"
            variant="ghost"
            className={cn("h-7 w-7", editor?.isActive(t.active) && "bg-muted text-foreground")}
            onMouseDown={e => e.preventDefault()}
            onClick={() => editor && t.run(editor)}
          >
            <t.icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("h-7 w-7", editor?.isActive("link") && "bg-muted text-foreground")}
          onMouseDown={e => e.preventDefault()}
          onClick={addLink}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none"
      />
      {mention && mention.items.length > 0 && (
        <div
          className="absolute z-50 bg-popover border border-border rounded shadow-md overflow-hidden min-w-[180px]"
          style={{ top: mention.top + 40, left: mention.left + 12 }}
        >
          {mention.items.map(u => (
            <button
              key={u.id}
              type="button"
              data-mention-pick="1"
              onMouseDown={e => {
                e.preventDefault();
                mention.command({ id: u.id, label: u.name.split(" ")[0] });
              }}
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

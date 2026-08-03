# Replace execCommand with Tiptap

The rich-text editor (`src/components/pm/project/RichTextEditor.tsx`) is a hand-rolled `contentEditable` driven by the deprecated `document.execCommand`. Swap the internals for Tiptap (ProseMirror) while keeping the component's public props, toolbar, styling, and saved HTML output identical.

## Scope

The component is used in three places — task Description, project Overview, and the Documentation tab. Its prop contract (`value`, `onChange`, `onBlur`, `placeholder`, `users`) stays exactly the same, so no call site changes.

## Changes

### Dependencies
Add `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, and `@tiptap/extension-mention` (with `@tiptap/suggestion`).

### `RichTextEditor.tsx` rewrite
- Build the editor with `useEditor`, configured with StarterKit (bold, italic, bullet list, ordered list, paragraph, history) plus Link and Placeholder.
- Keep the exact same five toolbar buttons and icons (Bold, Italic, List, ListOrdered, Link) and the same `onMouseDown={e => e.preventDefault()}` behavior. Each button calls the Tiptap chain equivalent:

```text
bold                -> chain().focus().toggleBold().run()
italic              -> chain().focus().toggleItalic().run()
insertUnorderedList -> chain().focus().toggleBulletList().run()
insertOrderedList   -> chain().focus().toggleOrderedList().run()
createLink          -> chain().focus().setLink({ href }).run()
```

- Add active-state styling to toolbar buttons using `editor.isActive(...)` (visual polish only, same buttons).
- Keep the link flow as-is (`window.prompt("Link URL")`).
- `onUpdate` emits `sanitizeHtml(editor.getHTML())` so persisted markup keeps going through DOMPurify exactly as today.
- Sync external `value` changes with `editor.commands.setContent(sanitizeHtml(value))`, guarded so it doesn't fire while the editor has focus (same guard as the current `useEffect`).
- Apply the same Tailwind classes to the editor content area via `editorProps.attributes.class` so list/link/placeholder styling and the `min-h-[96px] p-3 text-sm` sizing are unchanged.

### @mentions
Replace the manual caret/regex mention logic with Tiptap's Mention extension plus a suggestion renderer:
- Trigger char `@`, filtered against the `users` prop by name, capped at 6 results.
- Same popup look: bordered popover, name in medium weight, role in muted small text.
- Rendered mention node keeps the current markup contract — a `span` with `data-mention-id={user.id}`, class `text-primary bg-primary/10 rounded px-1`, and text `@FirstName` — so existing stored HTML and any downstream mention parsing keep working.
- When `users` is not provided, the Mention extension is omitted entirely.

### Sanitizer allowance
Verify `sanitizeHtml` preserves `data-mention-id`; if DOMPurify strips it, add `ADD_ATTR: ["data-mention-id"]` to the config. This is the only change outside the editor component.

## Verification
- Typecheck, then load a task workspace and the Documentation tab in the browser: confirm bold/italic/lists/link all apply, `@` mentions render, content persists on blur, and previously saved HTML renders unchanged.

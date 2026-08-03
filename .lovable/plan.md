# Sanitize rich-text HTML (stored XSS fix)

Rich-text content is stored as raw HTML and rendered directly, so a pasted `<script>` or `javascript:` link would run for every future viewer. Add DOMPurify sanitization at both save and render points, with no change to editing behavior or the toolbar.

## Changes

1. **Add dependency** — install `dompurify` (types ship with the package; add `@types/dompurify` only if needed).

2. **Shared config** — one small helper (`src/lib/pm/sanitizeHtml.ts`) exporting `sanitizeHtml(html)` using:
   `DOMPurify.sanitize(html, { FORBID_ATTR: ['onerror','onload'], ALLOWED_URI_REGEXP: /^(?!javascript:)/i })`
   so every surface uses identical rules.

3. **`src/components/pm/workspace/DescriptionSection.tsx`** (line 54) — wrap the `dangerouslySetInnerHTML` value in `sanitizeHtml()`.

4. **`src/components/pm/project/DocumentationTab.tsx`** (line 88) — same wrap on the read-only render.

5. **`src/components/pm/project/RichTextEditor.tsx`** (the actual editor path; there is no `workspace/RichTextEditor.tsx`) —
   - sanitize the HTML in the `onChange` emit points (`cmd`, `handleInput`, `pickMention`) so what gets stored is already clean;
   - sanitize the incoming `value` before assigning to `el.innerHTML` in the mount/sync effect.

   Sanitizing is applied only to the emitted/loaded value — the toolbar, mention popover, caret handling, and blur logic stay untouched.

## Note

`src/components/ui/chart.tsx` also uses `dangerouslySetInnerHTML`, but only for generated CSS from theme config (no user input), so it's out of scope.

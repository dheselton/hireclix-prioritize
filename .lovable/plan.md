## Snippets Library — Plan

A new role-gated page at `/snippets` for Developers and Designers to browse, search, and copy reusable code snippets, with multi-variation support and syntax highlighting.

### 1. Database (single migration)

Three new tables, permissive RLS to match existing `pm_*` pattern (auth is disabled in dev):

- `pm_snippet_categories` — id, name, color, created_at
- `pm_snippets` — id, title, description, category_id → categories, language, tags[], project_ids[], created_by, created_at, updated_at
- `pm_snippet_variations` — id, snippet_id → snippets (cascade), name, code, sort_order, created_at

Seed `pm_snippet_categories` with: Webflow, Custom JS, CSS Utilities, HTML Components, Animations, Forms, API / Integrations (each with a distinct color token).

Add `updated_at` trigger on `pm_snippets` using existing `update_updated_at_column()`.

### 2. Role gating

- Add `/snippets` route in `src/App.tsx` wrapped in `AppLayout`.
- In `AppSidebar.tsx`, add a new nav item "Snippets" (Code icon) shown only when `role === 'developer' || role === 'designer'`.
- Add `/snippets` to `SubmitterRouteGuard` blocked prefixes as a safety net, plus a redirect in the page itself if the role isn't allowed (covers PM/strategist/analyst too).

### 3. Data layer

New `src/lib/pm/snippets.ts` with:
- `fetchCategories()`, `createCategory()`, `renameCategory()`, `deleteCategory()`
- `fetchSnippets()` joining variations
- `createSnippet()`, `updateSnippet()`, `deleteSnippet()`, `duplicateSnippet()`
- Variation CRUD batched inside save (delete-then-insert by snippet_id for simplicity)

### 4. Page composition

`src/pages/pm/Snippets.tsx` — top bar (title, subtitle, "+ New Snippet"), two-column grid `240px 1fr`.

Components under `src/components/pm/snippets/`:
- `SnippetsSidebar.tsx` — search input, category list with counts + "Manage Categories", tag filter pills
- `SnippetsToolbar.tsx` — result count, sort dropdown (Newest | A–Z | Most Used), grid/list view toggle (reuse `useViewMode`)
- `SnippetCard.tsx` — grid card: header (title, category badge, ⋯ menu), description, tag pills (+N more), variation segmented control (hidden if 1), code preview (collapsed at 6–8 lines with "Show more"), footer with "Used in X projects" + Copy button (2s "Copied ✓" state)
- `SnippetRow.tsx` — list row that expands inline to the same code+variations block
- `CodeBlock.tsx` — dark `#1e1e1e` block, language label, highlight.js highlighting
- `SnippetEditorDialog.tsx` — modal with Title, Category, Description (textarea), Tags input w/ autocomplete + inline create, Language dropdown, Variations repeater (name + code textarea, add/remove/reorder, ≥1 required), Used In Projects multi-select
- `ManageCategoriesDialog.tsx` — list with click-to-rename, delete (confirm if snippets exist), add new at bottom

### 5. Syntax highlighting

Load highlight.js from cdnjs on first mount of `CodeBlock` (script + CSS, atom-one-dark theme), register `javascript`, `css`, xml/html, `json`, and a small `liquid` rules fallback. Cache the load promise so multiple cards share one script tag.

### 6. Filtering behavior

All filters combine with AND:
- Live search on title + description + tags (lowercased contains)
- Selected category (or "All")
- Selected tag pills (every selected tag must be on the snippet)

Sort applied after filter; "Most Used" = `project_ids.length` desc.

### 7. Copy behavior

Copy button uses the currently selected variation's `code`, calls `navigator.clipboard.writeText`, swaps label to "Copied ✓" for 2s. If only one variation, segmented control is hidden and copy uses that variation directly.

### 8. Reuse / styling

- Reuse existing `Button`, `Input`, `Textarea`, `Badge`, `Card`, `Dialog`, `Select`, `DropdownMenu`, `Tabs` (for variation switcher) from `src/components/ui/*`.
- Use only semantic tokens (`info`, `muted`, `border`, etc.) — no raw colors except the spec-mandated `#1e1e1e` code background, which will be added as a `--code-bg` token in `index.css` and used via `bg-[hsl(var(--code-bg))]`.
- Date display follows existing `mm/dd/yyyy` convention.

### Technical notes

- Variations: on save, replace all rows for the snippet in one transaction-like sequence (`delete where snippet_id = …` then bulk insert). Sort preserved by `sort_order` from drag order.
- Category color: store HSL string in `color` column; render badge via inline `style={{ background: hsl(var) }}` fallback to `bg-muted`.
- `created_by`: use `getCurrentUserId()` from `mockUser` (auth disabled).
- Add `/snippets` and a "Snippets" Core memory line noting the role gate, since the rule is universal.

# Snippet instructions + Loom support + usage visibility

Enhance the snippet library so each snippet can carry implementation guidance (written instructions + an optional Loom/video link) and clearly show where it's actually used across live projects and templates. No data model overhaul — just additive columns and a new usage panel that queries existing link tables.

## Scope

1. Add `instructions` (long-form markdown-ish text) and `video_url` to snippets.
2. Surface both on the snippet card with the same patterns we already use elsewhere.
3. Replace the misleading "Used in N projects" footer (currently counted from a stale `project_ids` array) with a real usage list pulled from `pm_task_snippets` and `pm_template_task_snippets`.

## Schema change

Single migration adding two nullable columns:

```sql
ALTER TABLE public.pm_snippets
  ADD COLUMN instructions text,
  ADD COLUMN video_url text;
```

No new tables, no RLS changes, no grants needed (table already configured).

## Editor changes — `SnippetEditorDialog.tsx`

Add two fields under the existing Description field, before Variations:

- **Instructions** — `Textarea` (rows=5), placeholder "Step-by-step notes for a teammate using this snippet (where to paste, gotchas, required setup)."
- **Loom / video link** — `Input type="url"`, placeholder "https://loom.com/share/…". Light client-side validation: must start with `http`. We accept any URL (Loom, YouTube, Vimeo, internal share) — copy says "Loom or other video link".

Wire both through `SnippetInput`, `createSnippet`, `updateSnippet`, `duplicateSnippet`, and the `Snippet` type in `src/lib/pm/snippets.ts`.

## Card changes — `SnippetCard.tsx`

- If `instructions` exists, render a collapsible "Instructions" panel above the variation tabs using the existing muted-surface pattern (rounded `bg-muted/50` block, `text-[13px]`, default collapsed with a "Show instructions" toggle that flips to "Hide"). Preserves whitespace with `whitespace-pre-wrap`.
- If `video_url` exists, render a small inline button next to the category chip in the header: `<Button variant="outline" size="sm">` with `Video` lucide icon + label "Watch Loom" (or "Watch video" for non-loom hosts — detected by `url.includes("loom.com")`). Opens in a new tab (`target="_blank" rel="noreferrer"`), matches the existing link/attachment patterns used in `AttachmentsSection`.
- Replace the static "Used in N projects" footer with a new `<SnippetUsageFooter snippetId={…} />` (see below) — keeps the same visual slot, just driven by real data.

## New file — `src/components/pm/snippets/SnippetUsageFooter.tsx`

Tiny component that fetches and renders true usage:

- React-query hook `useSnippetUsage(snippetId)` keyed on the snippet id.
- Query joins:
  - `pm_task_snippets` → `pm_tasks (id, title, project_id, pm_projects(title))`
  - `pm_template_task_snippets` → `pm_template_tasks (id, title, template_id, pm_project_templates(name))`
- Footer renders: "Used in 3 projects · 2 templates" as a button-styled trigger that opens a `Popover` listing each usage as a clickable row:
  - Project tasks: deep link to `/pm/tasks/:id` (uses existing `useTaskDrawerLink` open behavior — full workspace, not Quick Edit).
  - Templates: deep link to `/pm/templates/:id` (existing route).
- Zero usage → muted "Not used yet" label, no popover.

## Files touched

- **Migration** — add 2 columns to `pm_snippets`.
- **Edited**
  - `src/lib/pm/snippets.ts` — extend types, persistence, duplicate.
  - `src/components/pm/snippets/SnippetEditorDialog.tsx` — add 2 fields.
  - `src/components/pm/snippets/SnippetCard.tsx` — instructions panel, video button, swap footer.
- **Created**
  - `src/components/pm/snippets/SnippetUsageFooter.tsx` — real usage list popover.

## Out of scope

- No embedded video player — we link out (matches existing attachment patterns).
- No rich-text editor for instructions (plain text + line breaks, like other description fields in the app).
- No changes to `SnippetRow`, search popover, or template summary cells (footer there is already minimal).
- No backfill — `instructions`/`video_url` stay null on existing rows.

## Success criteria

- Author can add instructions + a Loom URL when creating/editing a snippet, and both persist.
- Snippet card shows a collapsible Instructions panel and a "Watch Loom" button when present, using existing components and tokens.
- The card footer reflects actual current usage from `pm_task_snippets` + `pm_template_task_snippets`, and each row deep-links to the task workspace or template editor.
- Existing snippet library structure, list/search behavior, and styles are unchanged.

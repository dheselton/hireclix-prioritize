## Goal

Make tags *mean something*. Instead of a free-text field nobody sees, tags become a small, curated vocabulary organized into three namespaces — **client**, **type**, and **feature** — surfaced consistently on cards, in filters, and in search.

## The taxonomy

Every tag is stored as a namespaced string in `pm_tasks.tags` / `pm_projects.tags`:

- `client:hireclix`, `client:acme` — who the work is for (auto-applied from the project's client; users don't type these)
- `type:careersite`, `type:webflow`, `type:integration`, `type:sow`, `type:support` — project shape / delivery model (managed by PM on the project, inherited by tasks)
- `feature:job-feed`, `feature:apply-flow`, `feature:analytics`, `feature:seo`, `feature:accessibility` — the *thing* the work touches (chosen from a curated list, addable by PMs)

Internal flags stay as-is (`support`, `type:dev`, etc.) but move to a hidden `custom_fields.system_tags` array so they stop polluting the visible tag surface.

## What changes

### 1. Curated tag catalog
- New table `pm_tag_catalog` (namespace, slug, label, color, created_by).
- Seed with the type + feature tags above; PMs can add more from a small "Manage tags" screen at `/pm/settings/tags` (PM-only).
- Client tags are generated on the fly from `clients` — not stored in the catalog.

### 2. Auto-application
- On project create / client change: project gets `client:<slug>` + selected `type:*` tags.
- On task create: task inherits its project's `client:*` and `type:*` tags automatically. `feature:*` tags are chosen per-task (or per-project, and inherited).
- `instantiateTemplateIntoProject` carries template `feature:*` tags to live tasks.

### 3. Intentional input UI
- New `TagPicker` component (combobox grouped by namespace) replaces the current free-text `tags` input.
  - Used in `NewTaskDialog`, `TaskWorkspace` right rail, `EditProjectDialog`, and template task editor.
  - Client + type tags render as read-only chips (inherited); only `feature:*` is editable inline.
  - "+ New feature tag" inside the picker (PM-only) writes to `pm_tag_catalog`.

### 4. Visible on cards
- `TagPill` component with per-namespace styling (client = neutral, type = brand accent, feature = teal).
- Render up to 3 pills on `BoardTaskCard`, `ProjectTaskCard`, `RequestTaskCard`, and TaskWorkspace header, with a "+N" overflow tooltip.
- Project header shows its type + feature pills.

### 5. Filter + search
- Add a **Tags** filter chip on `/pm/work` (multi-select, grouped by namespace). Wired through `applyTaskChips` + `buildQueueLink` (`tags=feature:seo,type:careersite`) so deep links work everywhere per the clickable-callouts rule.
- Global search (⌘K if present, otherwise the Work search box) matches on tag label + slug.

### 6. Cleanup
- Migration strips existing free-text tags that don't match a namespace (moves them to `custom_fields.legacy_tags` for safety) and rewrites `support` / `type:dev` style internal flags into `custom_fields.system_tags`.
- Existing "support mode" logic reads from `system_tags` instead of `tags`.

## Out of scope (for now)

- Tag analytics / reporting.
- Bulk retag tools beyond the migration.
- Client-facing tag visibility.

## Technical notes

- New table: `pm_tag_catalog(id, namespace text check in ('type','feature'), slug text, label text, color text, created_by uuid, created_at)`, unique on `(namespace, slug)`. GRANTs + RLS mirroring other `pm_*` tables (permissive while auth off).
- Helpers in new `src/lib/pm/tags.ts`: `parseTag`, `groupTags`, `useTagCatalog`, `applyProjectTagsToTask`, `mergeInheritedTags`.
- Filter integration in `src/lib/pm/filters.ts` extends the existing chip contract; URL param `tags` parsed in `Work.tsx` and passed through `applyTaskChips`.
- Migration order: create catalog → seed → backfill client/type tags on existing projects+tasks → move internal flags to `system_tags`.

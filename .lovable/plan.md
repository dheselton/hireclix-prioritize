## Goal

1. **Quick Request** creation gets a "Request Type" selector (Web edit, Banner ads, Social, Email, General) that conditionally shows the right fields — same UX as the public creative request form.
2. **Full Project** creation surfaces three paths up front: pick a Template, start Blank, or build a New Template.
3. Conditional field sets are stored as internal `pm_forms` rows so admins can edit them in Form Builder later.

---

## Part 1 — Quick Request: conditional fields

### Data approach

Use the existing `pm_forms` / `pm_form_fields` / `pm_form_submissions` tables. Seed five internal forms (one per request type), tagged as internal so they don't appear in the public Forms list:

- `internal_web_edit` — Page URL, Change description, Asset link, Priority
- `internal_banner_ads` — Sizes (multi), Ad copy, Landing URL, Brand assets link, Run dates
- `internal_social` — Platform(s), Caption, Asset link, Post date
- `internal_email` — Subject, Audience, Send date, Asset link
- `internal_general` — Notes only (fallback)

Each `pm_form_fields` row already supports `conditionals` JSON, but for this round we don't need cross-field conditionals — selecting the type swaps the whole field set.

**Schema additions:**
- `pm_forms.kind text default 'public'` — values: `'public' | 'internal_request'`
- `pm_forms.request_type text` — `'web_edit' | 'banner_ads' | 'social' | 'email' | 'general'` (null for public)
- Filter `Forms` page to `kind='public'`.

### UI changes — `CreateWorkDialog.tsx`, Quick Request step

```text
[ Title * ]
[ Client * ]
[ Request Type * ]  ← new selector (Web edit / Banner ads / Social / Email / General)
─── conditional fields rendered from the matching internal pm_form ───
[ Description ]     ← always shown, optional
[ Quick tasks (0–3) ] ← keep existing
```

- On type change, load fields for that internal form (cache by type).
- Render fields with the same input switch already used in `PublicForm.tsx` (extract into a shared `<FormFieldRenderer/>` component in `src/components/pm/forms/`).
- On submit:
  - Create the request `pm_project` (`work_type=request`, `type=quick_request`) as today.
  - Store field answers in `pm_projects.custom_fields` JSON keyed by field label slug, **and** also write a `pm_form_submissions` row referencing the internal form + new project for auditability.
  - Auto-create one task (existing behavior — uses title if no quick tasks).

### Display on the request workspace

`TaskWorkspace` / project detail already shows description. Add a small "Request details" section that pretty-prints `custom_fields` (label → value). No layout overhaul.

---

## Part 2 — Full Project entry: Template / Blank / New Template

### `CreateWorkDialog`, Project step

Replace the current single form with three primary cards at the top of the project step:

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ From Template│ │ Blank Project│ │ New Template…    │
│ (cards list) │ │ (manual)     │ │ (opens builder)  │
└──────────────┘ └──────────────┘ └──────────────────┘
```

- **From Template** — render list of `pm_project_templates` (same data as `Templates.tsx`). Selecting one launches the existing `TimelineSetupWizard` inline inside the dialog (or closes dialog and opens wizard, matching today's behavior on `/pm/templates`).
- **Blank Project** — current form (title, client, type, status, kickoff, go-live). Auto-assigns creator (already wired).
- **New Template** — closes the dialog and routes to `/pm/templates` with the "New Template" modal pre-opened (reuse the existing `setOpen(true)` flow via a query param like `?new=1`).

The current "Tip: use Templates → Use template" helper line is removed since these paths are now first-class.

---

## Part 3 — Files to touch

**New**
- `src/components/pm/forms/FormFieldRenderer.tsx` — shared field renderer (extracted from `PublicForm`).
- `src/components/pm/forms/useInternalRequestForm.ts` — hook that loads fields for a `request_type`.
- `supabase/migrations/<ts>_internal_request_forms.sql` — adds `kind`, `request_type` columns; seeds 5 internal forms with their fields.

**Edited**
- `src/components/pm/CreateWorkDialog.tsx` — Quick Request step gets type selector + dynamic fields; Project step gets 3-card entry UI.
- `src/pages/pm/PublicForm.tsx` — swap inline switch for `<FormFieldRenderer/>`.
- `src/pages/pm/Forms.tsx` — filter list to `kind='public'`; add small "Internal request forms" section linking to their builders (so they're discoverable + editable).
- `src/pages/pm/Templates.tsx` — read `?new=1` query param to auto-open the New Template modal.
- `src/integrations/supabase/types.ts` — regenerated automatically by the migration.

---

## Technical notes

- Internal form field labels become keys in `pm_projects.custom_fields` (use a slugified label for stable keys).
- The `pm_form_submissions` insert mirrors what `PublicForm.submit()` does today — keeps audit + Form Builder analytics consistent.
- `FormFieldRenderer` should accept `{ field, value, onChange }` and handle: text, textarea, email, number, date, dropdown, checkbox-group (multi). Add `checkbox_group` to support Banner ad "Sizes" and Social "Platforms".
- Conditional logic on individual fields (`field.conditionals`) is out of scope for v1 — the type selector already gives us per-type field sets. We can layer field-level conditionals later using the existing JSON column.
- No changes to RLS (tables remain permissive while auth is off).

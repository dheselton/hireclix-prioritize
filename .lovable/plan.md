
## Goal

Rebuild the intake forms so the flagship one mirrors the internal **Quick Request** dialog exactly (grouped request-type dropdown → dynamic per-type fields), while keeping the full ability to create/edit additional custom forms in the Form Builder.

## Wipe scope (revised)

- Wipe existing `pm_form_submissions`, `pm_form_fields`, and `pm_forms` rows.
- Seed **one** canonical form ("Quick Request") after the wipe.
- Form Builder + `/pm/forms` list remain fully functional — PMs can create new forms afterward exactly as they do today (same "New form" flow, same field editor, same shareable slug + embed).

## The canonical "Quick Request" form

Public URL: `/f/quick-request`. Embed: `<div data-pmform="quick-request"></div>` + existing `/embed/pm-form.js`.

Fields, top to bottom:

1. **Client** — searchable combobox (typeahead over `clients`) with inline "New client" (`NewClientPopover`). If URL has `?client=<id-or-name-slug>`, pre-select + collapse to a locked chip with a "Change" link. Falls back to picker when the param doesn't match.
2. **Requester** — same `RequesterPicker` + name/email pair used today on `PublicForm`.
3. **Request type** — grouped dropdown identical to `CreateWorkDialog` (`REQUEST_TYPE_GROUPS`: Career Site Support, Web, Ads & Campaigns, Content, Print & Collateral, Media, Brand, Other — 24 slugs).
4. **Dynamic per-type fields** — reveal via the existing `isFieldVisible()` engine, gated on `conditionals = [{ field: "request_type", in: [...] }]`. Packs cover: Display ad, Email, Landing page, Web edit, Career-site (bug/content/jobfeed/new page/SOW/support), Social, Video, Photo retouch, Presentation, Copywriting, Job description, Infographic, Recruiter/Event/Print collateral, Swag, Brand assets. Concise but thorough — mirrors what we already seeded for the General form, retargeted per request type.
5. **Ship-by date** + **Description** — always visible.
6. **Attachments + links** — `IntakeAttachmentsField` (unchanged).
7. **Submit** → same pipeline as `CreateWorkDialog`: create project (with `client_id`), create one `unclaimed` task, mirror description onto task, `persistIntakeAttachments({ taskId: null })`, `applyClientWatchers(projectId, clientId, requestType)`, show `SubmissionSuccess` with `aliasFor(requestType)`.

## Custom forms stay first-class

- `/pm/forms` list, "New form" button, per-form share/embed, and `FormBuilder` editing all remain.
- The Quick Request form is treated as a normal `pm_forms` row — editable in `FormBuilder` — with two small guards:
  - Its `Request type` field is undeletable (lock badge) so the dynamic reveal keeps working.
  - `FormBuilder` gains a minimal **"Show only when"** editor for each field's `conditionals` (field slug + comma-separated values) so PMs can add gated fields to any form, not just this one.
- Newly created forms behave exactly as today (no forced Request-type field, no forced grouping).

## Client via UTM

`PublicForm` reads `useSearchParams()` for `client`. Match order: exact `clients.id` → case-insensitive `slugifyLabel(name)`. On match, the client field renders as a locked chip with a "Change" affordance.

## Technical section

Files touched:

- **New migration** `supabase/migrations/<ts>_reset_forms.sql` — DELETE from `pm_form_submissions`, `pm_form_fields`, `pm_forms`; INSERT the Quick Request form row (`kind='internal_request'`, `shareable_slug='quick-request'`, `submit_action={creates:'task'}`); INSERT its field rows including per-type `conditionals`.
- **New** `src/components/pm/intake/ClientSearchCombobox.tsx` — shadcn Command + Popover over `clients`, reuses `NewClientPopover` and `useInternalClientIds()` accent.
- **New** `src/components/pm/intake/GroupedRequestTypeSelect.tsx` — extracts the grouped dropdown from `CreateWorkDialog` so both surfaces share one source of truth.
- **Edit** `src/pages/pm/PublicForm.tsx` — UTM `client` param, `ClientSearchCombobox`/locked chip, `GroupedRequestTypeSelect` when a `request_type` field exists, feed `request_type` into the `valuesBySlug` map for `isFieldVisible()`, submit through the Quick-Request pipeline described above.
- **Edit** `src/pages/pm/FormBuilder.tsx` — lock the Request-type field on the canonical form; add minimal `conditionals` editor row.
- **Edit** `src/components/pm/CreateWorkDialog.tsx` — swap inline grouped dropdown for the new `GroupedRequestTypeSelect` (no behavior change).
- **No changes** to `/pm/forms` list, "New form" flow, or `public/embed/pm-form.js`.

## Out of scope

- No changes to task auto-creation beyond what `PublicForm` already does.
- No visual redesign of intake.
- No wiring of `aliasFor()` into `send-transactional-email` yet (still display-only).

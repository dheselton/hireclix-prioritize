## Goal
Tighten intake forms so submissions feel structured and trustworthy: align with the new request-type taxonomy, auto-add watchers for specific client + request-type combinations, give submitters a real confirmation screen, and prepare a per-request-type email alias mapping so confirmation emails can be wired up later without re-plumbing.

## Files to add

### `supabase/migrations/<ts>_pm_client_watchers.sql`
New table `pm_client_watchers` with the standard pm permissive RLS:
- `id uuid pk default gen_random_uuid()`
- `client_id uuid not null references clients(id) on delete cascade`
- `user_id uuid not null references mock_users(id) on delete cascade`
- `request_type text` (nullable — null means "all request types for this client")
- `created_at timestamptz default now()`
- Unique `(client_id, user_id, coalesce(request_type, ''))`
- GRANTs + permissive RLS matching other pm_* tables.

### `src/lib/pm/requestAliases.ts`
Pure code map (no sends yet) used by the confirmation screens and reserved for future `send-transactional-email`:
- `REQUEST_TYPE_ALIASES: Record<RequestType, string>` — e.g. `careersite_* → careersite@hireclix.com`, `web_edit/landing_page → web@…`, ads → `ads@…`, etc., fallback `requests@hireclix.com`.
- `aliasFor(requestType)` helper.

### `src/lib/pm/clientWatchers.ts`
- `fetchClientWatchers(clientId, requestType): Promise<string[]>` — returns deduped userIds matching `(client_id=clientId AND (request_type=requestType OR request_type IS NULL))`.
- `applyClientWatchers(projectId, clientId, requestType)` — fetches matching watchers and upserts each into `pm_project_members` with `role='watcher'`.

### `src/components/pm/intake/SubmissionSuccess.tsx`
Reusable success panel (Card-based, semantic tokens only). Props: `title`, `requestType?`, `projectId?`, `taskId?`, `watcherIds`, `confirmationAlias`. Renders:
- Checkmark + "Request received".
- Reference: short id (last 6 of project id) + request-type label.
- "Watchers notified" avatar stack (existing `AvatarStack`) when any.
- Info row: "A confirmation email will be sent from `{alias}` once enabled." (greyed/italic — labels future behavior).
- Primary action button slot (children).

## Files to edit

### `src/components/pm/CreateWorkDialog.tsx`
- After `submitRequest()` succeeds: call `applyClientWatchers(proj.id, client_id, requestType)`, collect watcher ids, swap the dialog body to `<SubmissionSuccess>` with actions "Open request" (navigates to `/pm/projects/:id`) and "New request" (resets to step `request`). Do not auto-close.
- Same treatment for `submitProject()` (no request type → uses default alias).
- Move toast to a short success toast; success screen carries the detail.

### `src/pages/pm/PublicForm.tsx`
- After submit, render `<SubmissionSuccess>` instead of the bare "Thanks!" card. Show request-type label when the form is `kind=internal_request` (read from `form.custom_fields.request_type` if present on the submitted payload, otherwise omit).
- Compute watcher ids by calling `applyClientWatchers` when the form has a `client_id` association (skip silently otherwise).
- Pass `confirmationAlias` from `aliasFor(...)`.

### `src/components/pm/forms/useInternalRequestForm.ts` (verify only)
- Confirm the hook already returns the conditional fields for all entries in `REQUEST_TYPE_GROUPS`. No change unless a type is missing.

## Out of scope
- No real email sending — alias mapping + UI copy only. A follow-up task will wire `send-transactional-email`.
- No FormBuilder UI changes (admins manage watchers via DB / future settings screen).
- No styling overhaul — reuse `Card`, `Button`, `Input`, `Label`, `AvatarStack`, semantic tokens.

## Success criteria
- A request submitted for an internal HireClix `careersite_*` type auto-adds any watchers configured for that client/type as project members.
- Both the in-app dialog and the public form show a structured confirmation panel with a reference id, watcher avatars, and the future-confirmation-email note.
- Alias mapping is exposed via one helper so future email work imports a single source of truth.
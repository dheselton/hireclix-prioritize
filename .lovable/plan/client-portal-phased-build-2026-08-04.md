# Client Portal — phased build

Two surfaces sharing one data layer: an internal "My Work" view inside the app, and a token-based external portal for clients with no login. Delivered one phase at a time, like the audit backlog.

## Corrections to the prompts (verified against the codebase)

- The clients table is `clients`, not `pm_clients` — all foreign keys will point at `clients(id)`.
- Task comments live in `pm_comments`, not `pm_task_comments` — the `visibility` column goes there.
- There is no Client detail page today. Phase 5 will add `/pm/clients` (list) and `/pm/clients/:id` (detail with the Portal tab).
- The proposed RLS (`auth.role() = 'authenticated'`) would lock out the external portal entirely, since app auth is currently disabled and portal visitors are anonymous. Per your choice, the external portal reads and writes only through a service-role edge function that validates the token server-side; the portal tables stay closed to `anon`.
- `mock_users.email` is nullable, so the auto-created portal identity for internal submitters (Phase 5D) is skipped when a user has no email.

## Phase 1 (this round) — database foundation

Single migration creating:

**`pm_portal_access`** — one row per invited person: token (uuid, unique), email, label, `client_id` → `clients`, `created_by` → `mock_users`, `is_active`, `last_accessed_at`, `invite_sent_at`, `created_at`. Indexes on email, token, client_id.

**`pm_portal_messages`** — the client-facing thread: `project_id` → `pm_projects` (cascade), `author_user_id` → `mock_users` or `author_portal_id` → `pm_portal_access` (exactly one, enforced by a check), denormalised `author_name`, `body`, `attachments` jsonb array, timestamps + updated_at trigger. Indexes on project_id and (project_id, created_at).

**`pm_portal_notifications`** — the email/notification queue: `portal_access_id`, `user_id`, `kind`, `project_id`, `task_id`, `subject`, `message`, `emailed_at`, `created_at`. `kind` constrained to `portal_invite | comment_added | status_changed | file_uploaded | request_completed | update_posted`.

**Column additions**
- `pm_comments.visibility text not null default 'internal'` check in (`internal`,`client`).
- `pm_tasks.needs_client_update boolean not null default false`.

**Access control**
- GRANTs to `authenticated` and `service_role` on all three tables; no `anon` grant — the external portal goes through the edge function.
- RLS enabled on all three. Because app auth is still off, policies match the existing permissive PM-table convention so the internal app keeps working, and get tightened alongside the rest of the `pm_` tables when auth is switched on.

**Storage** — create a private `portal-attachments` bucket now so Phase 3's composer has somewhere to upload; downloads use signed URLs.

Verification after the migration: query `information_schema.columns` and `pg_tables` to confirm the three tables, two columns, and grants landed.

## Later phases (for reference, not built this round)

- **Phase 2** — `/pm/my-work` page with My Tasks / My Requests / Messages tabs; sidebar "My Work" item first for every role; submitter-only users land there and see a stripped sidebar.
- **Phase 3** — client-visible toggle on the comment composer (PM/BA only) plus a green "Client visible" badge; new reusable `PortalMessageThread` with realtime inserts, attachment chips, and a composer.
- **Phase 4** — public `/portal/:token` page with no app chrome, reading through the `portal-api` edge function: status summary, message thread, files, submitted requests.
- **Phase 5** — `/pm/clients` + client detail with a Portal tab (invite, copy link, resend, revoke), a Share button on ProjectDetail, and a batched "Portal" badge on project cards.
- **Phase 6** — extend `send-request-email` for the new kinds, add the `pm_portal_notifications` insert trigger, and extend the task-status trigger for `in_progress` / `in_review`.

## Technical notes

- `pm_portal_messages` uses a `CHECK` that exactly one author column is non-null, so a row can never be ambiguous about whether it came from the team or the client.
- No `CHECK` constraint uses `now()` anywhere — time-dependent rules stay in triggers.
- Nothing in Phase 1 touches existing tables' behaviour beyond two additive, defaulted columns, so no current query or component changes.

# Finish the Client pages (CLIENT-2 / CLIENT-3)

The portal plumbing is complete, but the client pages are thin: the list is name + counts, and the detail page only has Projects and Portal tabs. There is also no client data yet (zero portal invites), so nothing feels "live". This closes the gaps found in the earlier audit.

## Client detail page

Turn `/pm/clients/:id` into a real client hub with deep-linkable tabs (`?tab=`), matching how project detail works:

- **Overview** (new, default): actionable stat tiles — active projects, open tasks, overdue tasks, unclaimed requests, hours logged (30d), portal invites active. Every tile links to the matching filtered view (`buildQueueLink`) rather than being a dead number. Plus a recent-activity list and the client's key contacts.
- **Projects** (existing): keep, add status/work-type grouping and an "Active / All" toggle.
- **Notes** (new): rich-text notes per client (account context, caveats, do-not-do list) with author + timestamp.
- **Assets** (new): logos, brand guides, style references — upload, in-app preview via the existing `PreviewProvider`, download.
- **Portal** (existing): unchanged.

## Client header actions

- Rename client, toggle internal flag, edit notes field — via an Edit dialog (PM/BA only).
- Archive client (soft, confirmed via `ConfirmDialog`, blocked while active projects exist) instead of hard delete.
- Internal-client purple treatment and a portal-status pill in the header.

## Clients list page

- Show overdue count, next go-live date, and portal status on each row.
- Sort control (name / most active / next go-live) and an "Internal only / Clients only" filter.
- Each count on a row links straight to its filtered view.

## Technical notes

- New tables: `pm_client_notes` (client_id, body html, author, timestamps) and `pm_client_assets` (client_id, name, path, type, size, uploaded_by). Both get GRANTs + permissive RLS consistent with the other `pm_` tables while auth is off.
- New private storage bucket `client-assets` with policies mirroring `portal-attachments`; uploads go through the existing atomic helper in `src/lib/pm/uploads.ts` so failures roll back.
- `clients` gets an `archived_at` column for soft archive.
- New `src/lib/pm/clientHub.ts` for the aggregate stat/notes/assets hooks (react-query cached, same pattern as `src/lib/pm/clients.ts`).
- Tab state synced to `?tab=` with a validated whitelist, same helper pattern as `ProjectDetail.tsx`.
- All stat tiles route through `buildQueueLink()` so they land on `/pm/work` with real filters applied.

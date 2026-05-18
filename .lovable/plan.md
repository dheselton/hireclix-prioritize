## Project Detail Gaps — Plan

### 1. Schema changes (one migration)
- Add `kickoff_date date`, `client_contact_name text`, `client_contact_email text` to `pm_projects`.
- Create `pm_project_attachments` (id, project_id, type 'file'|'link', url, label, name, file_size bigint, uploaded_by uuid, created_at) with permissive RLS to match other `pm_*` tables.
- `pm_comments.pinned` already exists — reuse.
- Reuse existing `task-attachments` storage bucket for project-level uploads (path prefix `project/{project_id}/...`).

### 2. Files Tab (`src/components/pm/project/FilesTab.tsx`, new)
Replace placeholder with:
- Header filter bar: type chips (All / Images / Documents / Links), uploader picker (mock_users), date range.
- Drag-and-drop zone + "Upload file" / "Add link" buttons → writes to `pm_project_attachments`.
- "Project Files" collapsible section first (rows from `pm_project_attachments`).
- One collapsible section per task that has attachments (query `pm_attachments` joined to current project's tasks, group by `task_id`, header = task title, clickable opens TaskDrawer).
- Row: image thumbnail (via Supabase public URL) or file/link icon, name, size, uploader avatar, date, download, delete (own files, or current user role === 'pm').
- Empty state copy as specified.

### 3. Overview Tab edits (inside `ProjectDetail.tsx`)
- **Brief**: swap `<Textarea>` for a minimal rich-text editor. Use the project's existing `SmartTextarea` if it supports formatting; otherwise build a tiny `RichTextEditor` using `contentEditable` + `document.execCommand` for Bold/Italic/UL/OL/Link with a small toolbar. No new dependency.
- **Key Dates card**: add Kickoff DatePicker; show Kickoff · Start · Go-Live (mm/dd/yyyy via `fmtDate`). Persist via `updateProject`.
- New **Team card** (`TeamCard.tsx`): list `pm_project_members` joined to `mock_users` (avatar, name, project role). "Add member" popover → user search + role select (PM/Designer/Developer/Reviewer) → insert. Remove button visible only when current user role==='pm'; disabled if removing the only PM-on-project.
- New **Client card** (`ClientCard.tsx`): client name (read from `clients`), editable primary contact name + email, saved to `pm_projects.client_contact_*`.

### 4. Activity Tab edits
- Replace the plain `Textarea` comment box with the existing `MentionTextarea` from `src/components/pm/drawer/MentionTextarea.tsx`, using project members for suggestions; on post, insert `pm_comments` row with `mentions[]` and create one `pm_notifications` row per mentioned non-self user (link `?project={id}`). Render comment bodies via `MentionText`.
- Add three filter pills above the feed: **All / Comments only / Activity only** (local state). Default = All.
- PM-only pin icon per comment: toggles `pinned` boolean. Cap at 3 pinned (toast if exceeded). Sort: pinned first (with "📌 Pinned" label), then chronological. Pinning is a comment-only concept; pinned still respects the comment/activity filter.

### 5. Tasks Tab
No change — pills (All / PM / Design / Dev / Review) and role default already exist in `TaskTabContent`. **Add** localStorage persistence per `project:user` key so the choice is remembered (currently only session-default by role).

### Files to add
- `src/components/pm/project/FilesTab.tsx`
- `src/components/pm/project/TeamCard.tsx`
- `src/components/pm/project/ClientCard.tsx`
- `src/components/pm/project/RichTextEditor.tsx` (lightweight, no new dep)
- `supabase/migrations/<timestamp>_project_detail_gaps.sql`

### Files to edit
- `src/pages/pm/ProjectDetail.tsx` — wire Files/Overview/Activity changes, add localStorage to pills.

### Open question
The Tasks tab pills already exist with the exact pill set, default-by-role behavior, and auto-collapse of empty phases. Only **localStorage persistence** is missing. I'll add that. Confirm that's the intended scope for Tasks Tab and no other change is needed.

# Task Drawer Completion — Plan

Goal: extend `src/components/pm/TaskDrawer.tsx` with 9 fully-functional sections beneath the existing fields. Drawer shell, header, layout grid, and current fields stay untouched.

## Schema reuse vs. new

The DB already has most of what's needed. Mapping spec → existing schema:

| Spec name | Existing table | Notes |
|---|---|---|
| `pm_subtasks` | **pm_subtasks** | columns differ: `complete` (not completed), `sort_order` (not position). Use as-is. |
| `pm_checklists` | **pm_checklist_items** | columns: `label`, `checked`, `sort_order`. Use as-is. |
| `pm_task_attachments` | **pm_attachments** | needs new columns: `type` ('file'|'link'), `label`, `file_size`. Add via migration. |
| `pm_task_dependencies` | **pm_task_dependencies** | already exists, fully usable. |
| `pm_time_entries` | **pm_time_entries** | already used. |
| `pm_design_rounds` | NEW | create table. |
| `pm_dev_status_log` | NEW dedicated table | currently `dev_status_log` jsonb on pm_tasks; migrate writes to new table, keep reading legacy jsonb as fallback. |
| `pm_notifications` | **pm_notifications** | already exists. |
| comments | **pm_comments** | already exists with `mentions uuid[]`. Use it. |

Storage bucket `task-attachments` (private) to create with public-read RLS suitable for app context.

## Migration (single call)

1. `ALTER TABLE pm_attachments ADD COLUMN type text DEFAULT 'file'`, `label text`, `file_size bigint`.
2. `CREATE TABLE pm_design_rounds (id, task_id, round_number int, submitted_date date, feedback_notes text, status text default 'pending', created_at)` + permissive RLS (matches sibling pm_ tables).
3. `CREATE TABLE pm_dev_status_log (id, task_id, note text, author_id uuid, created_at)` + permissive RLS.
4. Create storage bucket `task-attachments` with permissive public RLS (auth is currently off).

## Component structure

Refactor `TaskDrawer.tsx` to render the existing top grid, then a vertical stack of section components below. Move out into `src/components/pm/drawer/`:

```
drawer/
  BlockerBanner.tsx          // red if status==='blocked'
  BlockedByBanner.tsx        // yellow if has incomplete blocked_by deps
  SubtasksSection.tsx
  ChecklistSection.tsx
  AttachmentsSection.tsx
  DependenciesSection.tsx
  TimeTrackingSection.tsx    // replaces inline quick-add; keeps +15/+30/+1h
  DesignRoundsSection.tsx    // only when task.type==='design'
  DevStatusLogSection.tsx    // only when task.type==='dev'
  CommentsThread.tsx
  MentionTextarea.tsx        // shared @mention input
  TaskPicker.tsx             // searchable picker for dependency adds
```

Each section: collapsible `<details>`-style header with title + count/total badge, loads its own data via supabase, optimistic updates, emits `emitTasksChanged()` on count-affecting mutations.

## Section behavior details

- **Subtasks / Checklist** — identical UX: list rows with checkbox, inline-edit title (click to edit, blur to save), trash icon on hover, drag handle (use `@dnd-kit/sortable`, already in deps if present — otherwise simple ↑↓ buttons), inline "Add…" input at bottom. Header badge `done/total`. Checklist also shows green "All done" pill when total>0 && done===total.
- **Attachments** — drop zone (HTML5 drag events) + Browse button → `supabase.storage.from('task-attachments').upload(\`${task_id}/${crypto.randomUUID()}-${filename}\`)` → insert row in pm_attachments with `type:'file'`, `name`, `url` (public URL), `file_size`, `uploaded_by`. Link form: URL + label → insert `type:'link'`. Row: image thumb when name matches image ext, else file icon, name, size, uploader name (lookup mock_users), uploaded_at, download (anchor) + delete (own only).
- **Dependencies** — query pm_task_dependencies where task_id=current ("Blocked by") and where depends_on_task_id=current ("Blocking"). Render rows with title + project name + status pill, clicking opens that task via `useTaskDrawerLink().open(id)`. Add button opens TaskPicker (search pm_tasks by title, optional project filter dropdown). BlockedByBanner renders at top if any blocked-by dep's task.status not in done/approved.
- **Time tracking** — keep current +15/+30/+1h. Below: total = sum(minutes) formatted h/m. Then scrollable log list (avatar/name from mock_users join, fmtDate, duration, note). Manual entry row: number inputs h+m + note textarea + Save. All inserts to pm_time_entries.
- **Design Rounds** — vertical list of `pm_design_rounds` rows ordered by round_number. Each row: label, DatePicker (submitted_date), expandable Textarea (feedback_notes), status Select with colored Badge (pending=muted, approved=green check, needs_revision=amber). "+ Add round" button auto-increments round_number.
- **Dev Status Log** — read from new `pm_dev_status_log` table merged with legacy `task.dev_status_log` jsonb (read-only for legacy entries). Monospace font, muted bg. Append-only input at bottom. No edit/delete affordances.
- **Blocker** — verify existing wiring. Add a useRef to remember previous status so clearing blocker reverts to it; if no previous status known, revert to `in_progress`. Red banner above all sections when status==='blocked'.
- **Comments** — list pm_comments where task_id=current, oldest→newest. MentionTextarea: detects `@` then shows popover of project members (from pm_project_members joined with mock_users; if none, fall back to all mock_users), insert renders `@firstname` styled span backed by stored uuid in `mentions[]`. Send on Enter, newline on Shift+Enter. On submit: insert pm_comments row; for each mention insert pm_notifications row with `type:'mention'`, `user_id`=mentioned, `title`="@X mentioned you in {task.title}", `link`=`?task={id}`. Edit allowed if `user_id===current && now-created_at<15min`. Delete allowed if own. Render saved `@name` tokens with `text-primary bg-primary/10 rounded px-1`.

## Card badge

Update task card components (Kanban card, list rows, ProjectWorkCard) to show subtask completion badge `✓ 2/5` when subtasks exist. Single shared helper `useSubtaskCount(taskId)` or aggregate via a single query in card lists.

## Files to add / edit

- New: 11 files under `src/components/pm/drawer/`
- Edit: `src/components/pm/TaskDrawer.tsx` (compose new sections, remove inline design/dev/time blocks that are now sectioned)
- Edit: `src/components/pm/TaskKanban.tsx`, card components in `src/components/pm/collections/*` (subtask badge)
- Migration: schema + storage bucket
- Lib: `src/lib/pm/api.ts` helpers for each new entity (CRUD wrappers) and `formatDuration(minutes)`

## Open questions

None blocking — proceeding will reuse existing tables as mapped above. If you prefer the spec's exact table names (`pm_checklists`, `pm_task_attachments`, `pm_dev_status_log` only, etc.) I'll rename in the migration; otherwise I'll keep the existing `pm_checklist_items` / `pm_attachments` to avoid data loss.

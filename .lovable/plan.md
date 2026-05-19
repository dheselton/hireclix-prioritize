## Add "Description & Notes" section to Task Workspace

The `pm_tasks.description` column already exists, so no migration is needed.

### New component
`src/components/pm/workspace/DescriptionSection.tsx`
- Header: `<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description & Notes</div>`
- Uses existing `RichTextEditor` (`src/components/pm/project/RichTextEditor.tsx`) — already supports bold, italic, bullet list, numbered list, links.
- Placeholder: `"Add notes, context, or instructions for this task..."`
- Local state mirrors `task.description`; on blur, if changed, calls `patch({ description })`.
- Display mode when blurred + has content: render HTML via `dangerouslySetInnerHTML` inside a clickable div with the same prose styling; click switches to editor mode and focuses it. When empty, show editor directly so placeholder is visible.

### @mentions
`RichTextEditor` is a `contentEditable` with `document.execCommand` and does not support mentions. The existing `MentionTextarea` is plain-text only. To satisfy "Supports … @mentions" without adding a library or building a full mention engine inside contentEditable, add a lightweight `@` autocomplete:
- On `keyup` in the editor, detect if caret is in an `@token` at end of a text node.
- Show a small popover (reuse `Popover` or absolute-positioned div, matching `MentionTextarea` styling) listing matching `mock_users` (loaded once via `supabase.from("mock_users").select("id,name,role")`).
- Selecting a user replaces the `@token` with a styled `<span class="text-primary bg-primary/10 rounded px-1">@First</span>` and a trailing space.
- Mentioned span is part of the saved HTML, so it renders the same in display mode — no extra storage needed.

To keep `RichTextEditor` reusable, implement this in `DescriptionSection` as a thin wrapper that owns the textarea ref + popover state, OR add an optional `enableMentions` + `users` prop to `RichTextEditor`. Plan: add the optional props to `RichTextEditor` so other callers are unaffected and the workspace gets mentions for free.

### Wire-up
Edit `src/pages/pm/TaskWorkspace.tsx`:
- Import `DescriptionSection`.
- Render it as the first child of the left column, above `<AssetHub …/>`:
  ```
  <DescriptionSection task={task} patch={patch} />
  {task.status === "blocked" && <BlockerBanner />}
  <AssetHub … />
  ```
  (Keeping the blocker banner directly above AssetHub matches its current visual purpose; the new section sits at the very top.)

### Files
- New: `src/components/pm/workspace/DescriptionSection.tsx`
- Edited: `src/components/pm/project/RichTextEditor.tsx` (add optional `enableMentions`, `users` props + mention popover logic)
- Edited: `src/pages/pm/TaskWorkspace.tsx`

No DB migration, no new dependencies.
# Confirmations + feedback for silent deletes

Six destructive actions currently run instantly with no confirmation and no toast. Each gets a confirm step and success/error feedback. The deletion logic itself stays exactly as-is.

## Shared approach

The project already has `src/components/pm/ConfirmDialog.tsx` (an AlertDialog wrapper with title, description, Cancel/Delete buttons, busy state). Every location reuses it — no new dialog component.

Pattern per location:
- Hold the pending row in local state (`const [pending, setPending] = useState<Row | null>(null)`), since the trigger sits inside a mapped list.
- Trigger button sets `pending` instead of deleting.
- One `ConfirmDialog` rendered per component, `open={!!pending}`, `confirmLabel="Delete"`, description `"Delete [item]? This cannot be undone."`
- Confirm handler wraps the existing delete body in try/catch: `toast.success(...)` after reload, `toast.error(err.message)` on failure. Supabase `{ error }` results get checked and thrown.

## Locations

| File | Action | Confirm copy | Success toast |
|---|---|---|---|
| `workspace/AssetHub.tsx` | delete task attachment (storage + row) | Delete "{name}"? This cannot be undone. | File deleted |
| `workspace/CollabHub.tsx` | delete comment | Delete comment? This cannot be undone. | Comment deleted |
| `workspace/LinksSection.tsx` | delete reference link | Delete link? This cannot be undone. | Link removed |
| `project/FilesTab.tsx` | delete project file / task file | Delete "{name}"? This cannot be undone. | File deleted |
| `project/TeamCard.tsx` | remove project member | Remove {name} from this project? | Member removed |
| `workspace/ControlPanel.tsx` | remove assignee chip | Remove {name} from this task? | Assignee removed |

Notes:
- TeamCard keeps its existing "cannot remove the only PM/BA" guard — that check runs before the dialog opens, so the error toast still fires immediately.
- ControlPanel's chip removal is confirmed the same way; the `X` button opens the dialog.

## Owner/PM gating

- `LinksSection.tsx`: the trash button renders only when `roles.includes("pm")` or `l.created_by === user?.id`. `useCurrentUser()` is already imported there.
- `FilesTab.tsx`: the `Row` component already computes `canDelete = isPM || f.uploaded_by === user.id` — this will be confirmed to actually gate the rendered delete button, and applied if it currently only computes the value.

## Out of scope

No change to delete queries, storage removal paths, reload logic, or RLS.

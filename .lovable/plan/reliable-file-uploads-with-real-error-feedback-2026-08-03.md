# Reliable file uploads with real error feedback

Uploads can currently fail silently: if a file fails to reach storage, or the database record fails to save after the file lands, the user sees nothing and the file quietly disappears from the list (or leaves an orphaned file in storage with no record).

## What changes

1. **One shared upload routine** used everywhere files are uploaded, which for each file:
   - Uploads to storage. On failure: records the filename as failed, no silent skip.
   - Inserts the database record. On failure: deletes the just-uploaded storage file (so nothing is orphaned) and records the filename as failed.
   - Returns which files succeeded and which failed, instead of swallowing errors.

2. **Clear user feedback** on every upload surface:
   - Per-file error toast: "Failed to upload: report.pdf".
   - Batch summary when it's mixed: "3 of 5 files uploaded successfully."
   - All-success stays quiet/positive as it is today; all-failed shows an error.

3. **Intake attachments** (files attached while submitting a request / creating a task) go through the same routine, so a failed attachment during intake now surfaces a toast instead of only a console message.

Surfaces covered: Asset Hub on the task workspace, project Files tab, task drawer Attachments, and intake attachments.

No changes to the storage bucket, allowed file types, or the Asset Hub layout — only error handling and messages.

## Technical notes

- New helper `uploadAttachments()` in `src/lib/pm/uploads.ts`: takes files, a storage path prefix, the target table (`pm_attachments` or `pm_project_attachments`) and row fields; returns `{ succeeded: string[]; failed: string[] }`. Rollback uses `supabase.storage.from(bucket).remove([path])` when the insert errors.
- A small `reportUploadResult(result)` helper emits the per-file `toast.error` calls plus the mixed-batch summary toast, so messaging is identical across surfaces.
- `persistIntakeAttachments` in `src/lib/pm/api.ts` (the loop at ~line 258) delegates to the helper and returns the result; callers already awaiting it are unaffected.
- Callers updated: `src/components/pm/workspace/AssetHub.tsx`, `src/components/pm/project/FilesTab.tsx`, `src/components/pm/drawer/AttachmentsSection.tsx`.

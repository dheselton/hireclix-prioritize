import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ATTACHMENT_BUCKET = "task-attachments";

export interface UploadResult {
  succeeded: string[];
  failed: string[];
}

/**
 * Upload files to storage and insert matching DB rows.
 * - Storage failure -> file recorded as failed (never silently skipped).
 * - DB insert failure -> the uploaded storage object is removed (rollback), file recorded as failed.
 */
export async function uploadAttachments(opts: {
  files: File[] | FileList;
  /** Folder prefix inside the bucket, e.g. `task/<id>` or `project/<id>` */
  pathPrefix: string;
  table: "pm_attachments" | "pm_project_attachments";
  /** Extra columns merged into each inserted row (task_id / project_id / uploaded_by ...) */
  row: Record<string, any>;
  bucket?: string;
}): Promise<UploadResult> {
  const { pathPrefix, table, row } = opts;
  const bucket = opts.bucket ?? ATTACHMENT_BUCKET;
  const arr = Array.from(opts.files);
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const f of arr) {
    const path = `${pathPrefix.replace(/\/+$/, "")}/${crypto.randomUUID()}-${f.name}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, f);
    if (upErr) {
      console.error("storage upload failed", f.name, upErr);
      failed.push(f.name);
      continue;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const { error: insErr } = await supabase.from(table as any).insert({
      ...row,
      type: "file",
      name: f.name,
      url: pub.publicUrl,
      file_size: f.size,
    } as any);
    if (insErr) {
      console.error("attachment insert failed, rolling back storage object", f.name, insErr);
      await supabase.storage.from(bucket).remove([path]);
      failed.push(f.name);
      continue;
    }
    succeeded.push(f.name);
  }

  return { succeeded, failed };
}

/** Emit per-file error toasts plus a mixed-batch summary. */
export function reportUploadResult(result: UploadResult, opts?: { silentOnSuccess?: boolean }) {
  const { succeeded, failed } = result;
  const total = succeeded.length + failed.length;
  if (!total) return;

  for (const name of failed) toast.error(`Failed to upload: ${name}`);

  if (failed.length && succeeded.length) {
    toast.warning(`${succeeded.length} of ${total} files uploaded successfully.`);
  } else if (!failed.length && !opts?.silentOnSuccess) {
    toast.success(total === 1 ? "File uploaded" : `${total} files uploaded`);
  }
}

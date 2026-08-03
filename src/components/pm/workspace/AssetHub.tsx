import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";
import { usePreview } from "@/components/pm/attachments/PreviewProvider";
import { AttachmentThumb } from "@/components/pm/attachments/AttachmentThumb";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { uploadAttachments, reportUploadResult } from "@/lib/pm/uploads";

interface Att {
  id: string; task_id: string; type: string; name: string; url: string;
  file_size: number | null; uploaded_by: string | null; uploaded_at: string;
}

const BUCKET = "task-attachments";

export function AssetHub({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<Att[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const { openPreview } = usePreview();
  const [pendingDelete, setPendingDelete] = useState<Att | null>(null);

  async function load() {
    const { data } = await supabase
      .from("pm_attachments")
      .select("*")
      .eq("task_id", taskId)
      .eq("type", "file")
      .order("uploaded_at", { ascending: false });
    setItems((data || []) as Att[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function uploadFiles(files: FileList | File[]) {
    const res = await uploadAttachments({
      files,
      pathPrefix: taskId,
      table: "pm_attachments",
      row: { task_id: taskId, project_id: projectId, uploaded_by: user?.id ?? null },
      bucket: BUCKET,
    });
    reportUploadResult(res);
    await load();
  }

  async function remove(a: Att) {
    try {
    if (a.url.includes(`/${BUCKET}/`)) {
      const path = a.url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    const { error } = await supabase.from("pm_attachments").delete().eq("id", a.id);
    if (error) throw error;
    await load();
      toast.success("File deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete file");
    }
  }

  const previewItems = useMemo(
    () => items.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
    [items]
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Asset Hub (Uploads)
        </h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => fileRef.current?.click()}>
          <Plus className="h-3 w-3 mr-1" /> Upload assets
        </Button>
        <input
          ref={fileRef} type="file" multiple className="hidden"
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
      >
        {items.map((a, i) => {
          const own = !!user && a.uploaded_by === user.id;
          return (
            <div key={a.id} className="group relative">
              <AttachmentThumb
                item={{ id: a.id, name: a.name, url: a.url, type: a.type }}
                onClick={() => openPreview(previewItems, i)}
              />
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <a
                  href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
                  onClick={e => e.stopPropagation()}
                  className="bg-background/80 backdrop-blur rounded p-1 inline-flex"
                  title="Download"
                >
                  <Download className="h-3 w-3" />
                </a>
                {own && (
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setPendingDelete(a); }}
                    className="bg-background/80 backdrop-blur rounded p-1 text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="mt-1 text-xs truncate text-foreground" title={a.name}>{a.name}</div>
            </div>
          );
        })}

        {/* Drop zone (always last) */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "aspect-square rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/60 hover:text-primary transition",
            dragging && "border-primary text-primary bg-primary/5"
          )}
        >
          <Upload className="h-5 w-5 mb-1" />
          <span className="text-[11px]">Drop files</span>
        </button>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={o => { if (!o) setPendingDelete(null); }}
        title="Delete file?"
        description={`Delete "${pendingDelete?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => { if (pendingDelete) await remove(pendingDelete); setPendingDelete(null); }}
      />
    </section>
  );
}

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AttachmentThumb } from "@/components/pm/attachments/AttachmentThumb";
import { usePreview } from "@/components/pm/attachments/PreviewProvider";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { fmtDate } from "@/lib/pm/format";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { deleteClientAsset, uploadClientAsset, useClientAssets, type ClientAsset } from "@/lib/pm/clientHub";

function prettySize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ClientAssetsTab({ clientId }: { clientId: string }) {
  const { assets, loading, reload } = useClientAssets(clientId);
  const { user } = useCurrentUser();
  const { openPreview } = usePreview();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<ClientAsset | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const failed: string[] = [];
    for (const f of Array.from(files)) {
      try {
        await uploadClientAsset(clientId, f, user?.id ?? null);
      } catch (e) {
        console.error("client asset upload failed", f.name, e);
        failed.push(f.name);
      }
    }
    await reload();
    setBusy(false);
    if (failed.length && failed.length === files.length) toast.error(`Couldn't upload ${failed.join(", ")}`);
    else if (failed.length) toast.warning(`Uploaded, but ${failed.length} file(s) failed`);
    else toast.success(files.length === 1 ? "File uploaded" : `${files.length} files uploaded`);
  }

  const previewItems = assets
    .filter(a => a.url)
    .map(a => ({ id: a.id, name: a.name, url: a.url!, type: "file" }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Logos, brand guides, and style references the team should use for this client.
        </p>
        <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> {busy ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { onFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {loading && <Skeleton className="h-28 w-full" />}
      {!loading && assets.length === 0 && (
        <p className="text-sm text-muted-foreground">No assets uploaded yet.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {assets.map(a => {
          const idx = previewItems.findIndex(p => p.id === a.id);
          return (
            <Card key={a.id} className="p-2.5 flex items-center gap-3">
              <AttachmentThumb
                variant="row"
                item={{ id: a.id, name: a.name, url: a.url ?? "", type: "file" }}
                onClick={() => idx >= 0 && openPreview(previewItems, idx)}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground">
                  {prettySize(a.file_size)}{a.file_size ? " · " : ""}{fmtDate(a.created_at)}
                </div>
              </div>
              {a.url && (
                <a href={a.url} download={a.name} target="_blank" rel="noopener noreferrer"
                   className="text-muted-foreground hover:text-foreground" aria-label={`Download ${a.name}`}>
                  <Download className="h-4 w-4" />
                </a>
              )}
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                aria-label={`Delete ${a.name}`}
                onClick={() => setToDelete(a)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={o => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "this file"}?`}
        description="The file is removed from storage and can't be recovered."
        confirmLabel="Delete file"
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteClientAsset(toDelete);
            await reload();
            toast.success("File deleted");
          } catch (e: any) {
            toast.error(`Couldn't delete file: ${e.message ?? e}`);
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

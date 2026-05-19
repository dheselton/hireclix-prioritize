import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";

interface Att {
  id: string; task_id: string; type: string; name: string; url: string;
  file_size: number | null; uploaded_by: string | null; uploaded_at: string;
}

const BUCKET = "task-attachments";
const IMG_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function ext(name: string) {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

export function AssetHub({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<Att[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();

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
    const arr = Array.from(files);
    for (const f of arr) {
      const path = `${taskId}/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f);
      if (error) { toast.error(error.message); continue; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await supabase.from("pm_attachments").insert({
        task_id: taskId, project_id: projectId, type: "file", name: f.name,
        url: pub.publicUrl, file_size: f.size, uploaded_by: user?.id ?? null,
      } as any);
    }
    await load();
  }

  async function remove(a: Att) {
    if (a.url.includes(`/${BUCKET}/`)) {
      const path = a.url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    await supabase.from("pm_attachments").delete().eq("id", a.id);
    await load();
  }

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
        {items.map(a => {
          const isImg = IMG_RE.test(a.name);
          const own = !!user && a.uploaded_by === user.id;
          return (
            <div key={a.id} className="group">
              <a
                href={a.url} target="_blank" rel="noopener noreferrer"
                className="block aspect-square rounded-md border border-border bg-muted/40 overflow-hidden relative hover:border-primary/60 transition"
              >
                {isImg ? (
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                    <div className="text-xs font-mono font-semibold mb-1">.{ext(a.name).toLowerCase()}</div>
                    <div className="text-[10px] line-clamp-2 break-all">{a.name}</div>
                  </div>
                )}
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <span className="bg-background/80 backdrop-blur rounded p-1 inline-flex">
                    <Download className="h-3 w-3" />
                  </span>
                  {own && (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); remove(a); }}
                      className="bg-background/80 backdrop-blur rounded p-1 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </a>
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
    </section>
  );
}

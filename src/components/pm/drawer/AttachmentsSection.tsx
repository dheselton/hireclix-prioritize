import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Link as LinkIcon, FileIcon, Download, Trash2, X } from "lucide-react";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Att {
  id: string;
  task_id: string;
  type: string;
  name: string;
  url: string;
  label: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

const BUCKET = "task-attachments";
const IMG_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function fmtSize(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsSection({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<Att[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const users = useMockUsers();

  async function load() {
    const { data } = await supabase.from("pm_attachments").select("*").eq("task_id", taskId).order("uploaded_at", { ascending: false });
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
        task_id: taskId, project_id: projectId, type: "file", name: f.name, url: pub.publicUrl,
        file_size: f.size, uploaded_by: user?.id ?? null,
      } as any);
    }
    await load();
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    await supabase.from("pm_attachments").insert({
      task_id: taskId, project_id: projectId, type: "link",
      name: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim(),
      label: linkLabel.trim() || null, uploaded_by: user?.id ?? null,
    } as any);
    setLinkUrl(""); setLinkLabel(""); setShowLink(false);
    await load();
  }

  async function remove(a: Att) {
    if (a.type === "file" && a.url.includes(`/${BUCKET}/`)) {
      const path = a.url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    await supabase.from("pm_attachments").delete().eq("id", a.id);
    await load();
  }

  return (
    <SectionShell
      title="Attachments"
      badge={<Badge variant="secondary" className="ml-1">{items.length}</Badge>}
    >
      <div
        className={cn(
          "border-2 border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground transition-colors",
          dragging && "border-primary bg-primary/5"
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-5 w-5 mx-auto mb-1 opacity-60" />
        Drag &amp; drop files here, or
        <div className="flex justify-center gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Browse files</Button>
          <Button size="sm" variant="outline" onClick={() => setShowLink(s => !s)}>
            <LinkIcon className="h-3 w-3 mr-1" /> Add link
          </Button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={e => e.target.files && uploadFiles(e.target.files)} />
      </div>

      {showLink && (
        <div className="mt-2 p-2 border border-border rounded-lg space-y-2 bg-muted/30">
          <Input placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="h-8" />
          <Input placeholder="Label (optional)" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} className="h-8" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addLink}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLink(false)}><X className="h-3 w-3" /></Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1">
        {items.map(a => {
          const uploader = users.find(u => u.id === a.uploaded_by);
          const isImg = a.type === "file" && IMG_RE.test(a.name);
          const ownMine = !!user && a.uploaded_by === user.id;
          return (
            <div key={a.id} className="group flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted/40">
              {isImg ? (
                <img src={a.url} alt={a.name} className="h-9 w-9 object-cover rounded" />
              ) : a.type === "link" ? (
                <LinkIcon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate block hover:underline">{a.name}</a>
                <div className="text-[11px] text-muted-foreground">
                  {fmtSize(a.file_size)} {a.file_size ? "·" : ""} {uploader?.name ?? "—"} · {fmtDate(a.uploaded_at?.slice(0, 10))}
                </div>
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" download className="opacity-0 group-hover:opacity-100">
                <Button size="icon" variant="ghost" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
              </a>
              {ownMine && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => remove(a)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
        {!items.length && <div className="text-xs text-muted-foreground italic py-1">No attachments.</div>}
      </div>
    </SectionShell>
  );
}

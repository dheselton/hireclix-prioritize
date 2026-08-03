import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Upload, Link as LinkIcon, Download, Trash2, X } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PmTask } from "@/types/pm";
import { usePreview } from "@/components/pm/attachments/PreviewProvider";
import { AttachmentThumb } from "@/components/pm/attachments/AttachmentThumb";

const BUCKET = "task-attachments";
const IMG_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|zip|rar|key|pages|numbers)$/i;

interface FileRow {
  id: string;
  type: string; // 'file' | 'link'
  name: string;
  url: string;
  label: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  task_id: string | null;
}

function fmtSize(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

type FilterType = "all" | "images" | "documents" | "links";

export function FilesTab({ projectId, tasks, onOpenTask }: { projectId: string; tasks: PmTask[]; onOpenTask: (id: string) => void }) {
  const [projectFiles, setProjectFiles] = useState<FileRow[]>([]);
  const [taskFiles, setTaskFiles] = useState<FileRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { user, roles } = useCurrentUser();
  const users = useMockUsers();
  const isPM = roles.includes("pm");
  const { openPreview } = usePreview();

  const [type, setType] = useState<FilterType>("all");
  const [uploader, setUploader] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    const [{ data: pa }, { data: ta }] = await Promise.all([
      supabase.from("pm_project_attachments").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("pm_attachments").select("*").eq("project_id", projectId).order("uploaded_at", { ascending: false }),
    ]);
    setProjectFiles((pa || []).map((r: any) => ({
      id: r.id, type: r.type, name: r.name, url: r.url, label: r.label,
      file_size: r.file_size, uploaded_by: r.uploaded_by, created_at: r.created_at, task_id: null,
    })));
    setTaskFiles((ta || []).map((r: any) => ({
      id: r.id, type: r.type, name: r.name, url: r.url, label: r.label,
      file_size: r.file_size, uploaded_by: r.uploaded_by, created_at: r.uploaded_at, task_id: r.task_id,
    })));
  }
  useEffect(() => { load(); }, [projectId]);

  function matchesFilters(f: FileRow) {
    if (type === "images" && !(f.type === "file" && IMG_RE.test(f.name))) return false;
    if (type === "documents" && !(f.type === "file" && DOC_RE.test(f.name))) return false;
    if (type === "links" && f.type !== "link") return false;
    if (uploader !== "all" && f.uploaded_by !== uploader) return false;
    if (dateFrom && f.created_at.slice(0, 10) < dateFrom) return false;
    if (dateTo && f.created_at.slice(0, 10) > dateTo) return false;
    return true;
  }

  const filteredProject = projectFiles.filter(matchesFilters);
  const filteredTask = taskFiles.filter(matchesFilters);

  const grouped = useMemo(() => {
    const m = new Map<string, FileRow[]>();
    for (const f of filteredTask) {
      if (!f.task_id) continue;
      if (!m.has(f.task_id)) m.set(f.task_id, []);
      m.get(f.task_id)!.push(f);
    }
    return m;
  }, [filteredTask]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const f of arr) {
      const path = `project/${projectId}/${crypto.randomUUID()}-${f.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f);
      if (error) { toast.error(error.message); continue; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await supabase.from("pm_project_attachments").insert({
        project_id: projectId, type: "file", name: f.name, url: pub.publicUrl,
        file_size: f.size, uploaded_by: user?.id ?? null,
      } as any);
    }
    await load();
  }

  async function addLink() {
    if (!linkUrl.trim()) return;
    await supabase.from("pm_project_attachments").insert({
      project_id: projectId, type: "link",
      name: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim(),
      label: linkLabel.trim() || null, uploaded_by: user?.id ?? null,
    } as any);
    setLinkUrl(""); setLinkLabel(""); setShowLink(false);
    await load();
  }

  async function removeProject(f: FileRow) {
    if (f.type === "file" && f.url.includes(`/${BUCKET}/`)) {
      const path = f.url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    await supabase.from("pm_project_attachments").delete().eq("id", f.id);
    await load();
  }
  async function removeTaskFile(f: FileRow) {
    if (f.type === "file" && f.url.includes(`/${BUCKET}/`)) {
      const path = f.url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    }
    await supabase.from("pm_attachments").delete().eq("id", f.id);
    await load();
  }

  const allPreviewItems = useMemo(
    () => [...filteredProject, ...filteredTask].map(f => ({ id: f.id, name: f.name, url: f.url, type: f.type })),
    [filteredProject, filteredTask]
  );

  function Row({ f, onRemove }: { f: FileRow; onRemove: () => void }) {
    const u = users.find(x => x.id === f.uploaded_by);
    const canDelete = isPM || (user && f.uploaded_by === user.id);
    const idx = allPreviewItems.findIndex(p => p.id === f.id);
    const open = () => openPreview(allPreviewItems, Math.max(0, idx));
    return (
      <div className="group flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted/40">
        <AttachmentThumb
          item={{ id: f.id, name: f.name, url: f.url, type: f.type }}
          onClick={open}
          variant="row"
        />
        <div className="flex-1 min-w-0">
          <button type="button" onClick={open} className="text-sm truncate block hover:underline text-left w-full">
            {f.name}
          </button>
          <div className="text-[11px] text-muted-foreground">
            {fmtSize(f.file_size)}{f.file_size ? " · " : ""}{u?.name ?? "—"} · {fmtDate(f.created_at?.slice(0, 10))}
          </div>
        </div>
        <a href={f.url} target="_blank" rel="noopener noreferrer" download={f.name} className="opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
        </a>
        {canDelete && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  const totalAfterFilter = filteredProject.length + filteredTask.length;

  return (
    <Card><CardContent className="p-4 space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["all", "images", "documents", "links"] as FilterType[]).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`h-7 px-2.5 rounded-full text-xs border transition-colors ${type === t ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Select value={uploader} onValueChange={setUploader}>
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Uploaded by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36" />
        {(type !== "all" || uploader !== "all" || dateFrom || dateTo) && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setType("all"); setUploader("all"); setDateFrom(""); setDateTo(""); }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground transition-colors",
          dragging && "border-primary bg-primary/5"
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-5 w-5 mx-auto mb-1 opacity-60" />
        Drag &amp; drop project files here, or
        <div className="flex justify-center gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Upload file</Button>
          <Button size="sm" variant="outline" onClick={() => setShowLink(s => !s)}><LinkIcon className="h-3 w-3 mr-1" />Add link</Button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={e => e.target.files && uploadFiles(e.target.files)} />
      </div>

      {showLink && (
        <div className="p-2 border border-border rounded-lg space-y-2 bg-muted/30">
          <Input placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="h-8" />
          <Input placeholder="Label (optional)" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} className="h-8" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addLink}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLink(false)}><X className="h-3 w-3" /></Button>
          </div>
        </div>
      )}

      {/* Project Files section */}
      <Group title="Project Files" count={filteredProject.length} defaultOpen>
        {filteredProject.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-2 py-1">No project-level files.</div>
        ) : filteredProject.map(f => <Row key={f.id} f={f} onRemove={() => removeProject(f)} />)}
      </Group>

      {/* Per-task groups */}
      {Array.from(grouped.entries()).map(([taskId, items]) => {
        const t = tasks.find(x => x.id === taskId);
        return (
          <Group
            key={taskId}
            title={t?.title ?? "Unknown task"}
            count={items.length}
            onTitleClick={() => onOpenTask(taskId)}
          >
            {items.map(f => <Row key={f.id} f={f} onRemove={() => removeTaskFile(f)} />)}
          </Group>
        );
      })}

      {totalAfterFilter === 0 && (
        <div className="text-center text-sm text-muted-foreground italic py-8">
          No files yet — upload project assets or attach files to tasks.
        </div>
      )}
    </CardContent></Card>
  );
}

function Group({ title, count, defaultOpen, onTitleClick, children }: { title: string; count: number; defaultOpen?: boolean; onTitleClick?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1.5 py-1">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <button type="button" onClick={onTitleClick}
          className={`text-sm font-medium ${onTitleClick ? "hover:underline" : ""}`}>
          {title}
        </button>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <CollapsibleContent className="pl-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

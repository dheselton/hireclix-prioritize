import { useRef, useState } from "react";
import { Upload, Link as LinkIcon, X, FileIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface StagedLink { url: string; label: string }

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  links: StagedLink[];
  onLinksChange: (links: StagedLink[]) => void;
  label?: string;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function IntakeAttachmentsField({
  files, onFilesChange, links, onLinksChange,
  label = "Attachments & links",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [showLink, setShowLink] = useState(false);

  function addFiles(list: FileList | File[]) {
    onFilesChange([...files, ...Array.from(list)]);
  }
  function removeFile(i: number) {
    onFilesChange(files.filter((_, idx) => idx !== i));
  }
  function addLink() {
    if (!linkUrl.trim()) return;
    let u = linkUrl.trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    onLinksChange([...links, { url: u, label: linkLabel.trim() }]);
    setLinkUrl(""); setLinkLabel(""); setShowLink(false);
  }
  function removeLink(i: number) {
    onLinksChange(links.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <Label>{label}</Label>
      <div
        className={cn(
          "mt-1 border-2 border-dashed border-border rounded-lg p-3 text-center text-xs text-muted-foreground transition-colors",
          dragging && "border-primary bg-primary/5"
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-4 w-4 mx-auto mb-1 opacity-60" />
        Drag &amp; drop files here, or
        <div className="flex justify-center gap-2 mt-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            Browse files
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowLink(s => !s)}>
            <LinkIcon className="h-3 w-3 mr-1" /> Add link
          </Button>
        </div>
        <input
          ref={fileRef} type="file" multiple className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {showLink && (
        <div className="mt-2 p-2 border border-border rounded-lg bg-muted/30 space-y-2">
          <Input placeholder="https://figma.com/…" value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)} className="h-8"
            onKeyDown={e => { if (e.key === "Enter") addLink(); }} autoFocus />
          <Input placeholder="Label (optional)" value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)} className="h-8" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowLink(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={addLink}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
        </div>
      )}

      {(files.length > 0 || links.length > 0) && (
        <div className="mt-2 space-y-1">
          {files.map((f, i) => (
            <div key={`f-${i}`} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/40 text-xs">
              <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-muted-foreground">{fmtSize(f.size)}</span>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {links.map((l, i) => (
            <div key={`l-${i}`} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/40 text-xs">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{l.label || l.url}</span>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeLink(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

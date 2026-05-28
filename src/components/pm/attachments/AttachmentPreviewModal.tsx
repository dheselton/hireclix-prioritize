import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, ExternalLink,
  FileText, FileIcon, Image as ImageIcon, Video, Music, Link as LinkIcon,
} from "lucide-react";
import { detectKind, faviconFor, hostOf, PreviewKind, extOf } from "@/lib/pm/previewKind";
import { cn } from "@/lib/utils";

export interface PreviewItem {
  id: string;
  name: string;
  url: string;
  /** "file" | "link" — drives kind detection */
  type?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: PreviewItem[];
  index: number;
  onIndexChange: (i: number) => void;
}

const KindIcon = ({ kind, className }: { kind: PreviewKind; className?: string }) => {
  switch (kind) {
    case "image": return <ImageIcon className={className} />;
    case "video": return <Video className={className} />;
    case "audio": return <Music className={className} />;
    case "link":  return <LinkIcon className={className} />;
    case "pdf":
    case "office":
    case "text":  return <FileText className={className} />;
    default:      return <FileIcon className={className} />;
  }
};

export function AttachmentPreviewModal({ open, onOpenChange, items, index, onIndexChange }: Props) {
  const item = items[index];
  const kind = useMemo<PreviewKind>(
    () => (item ? detectKind(item.name || item.url, item.type) : "other"),
    [item]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, items.length, onIndexChange]);

  if (!item) return null;
  const isLink = item.type === "link";
  const title = item.name || item.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(1200px,95vw)] w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden bg-background flex flex-col"
        // hide default close, we render our own
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0">
          <KindIcon kind={kind} className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{title}</div>
            {isLink && <div className="text-[11px] text-muted-foreground truncate">{hostOf(item.url)}</div>}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {kind === "other" ? (extOf(item.name) || "file") : kind}
          </span>
          {items.length > 1 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">{index + 1} / {items.length}</span>
          )}
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-8 gap-1"><ExternalLink className="h-3.5 w-3.5" />Open</Button>
          </a>
          {!isLink && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" download={item.name}>
              <Button size="sm" variant="ghost" className="h-8 gap-1"><Download className="h-3.5 w-3.5" />Download</Button>
            </a>
          )}
          {/* Built-in close X is rendered by DialogContent */}
          <span className="w-8" />
        </div>

        {/* Body */}
        <div className="relative flex-1 min-h-0 bg-muted/30">
          {items.length > 1 && index > 0 && (
            <button
              type="button"
              onClick={() => onIndexChange(index - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {items.length > 1 && index < items.length - 1 && (
            <button
              type="button"
              onClick={() => onIndexChange(index + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          <PreviewBody item={item} kind={kind} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ item, kind }: { item: PreviewItem; kind: PreviewKind }) {
  switch (kind) {
    case "image":
      return (
        <div className="h-full w-full flex items-center justify-center p-4 bg-black/80">
          <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain" />
        </div>
      );
    case "pdf":
      return <iframe src={`${item.url}#toolbar=1`} title={item.name} className="h-full w-full bg-white" />;
    case "video":
      return (
        <div className="h-full w-full flex items-center justify-center bg-black">
          <video src={item.url} controls className="max-h-full max-w-full" />
        </div>
      );
    case "audio":
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-8">
          <Music className="h-16 w-16 text-muted-foreground" />
          <audio src={item.url} controls className="w-full max-w-md" />
        </div>
      );
    case "office": {
      const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.url)}`;
      return <iframe src={src} title={item.name} className="h-full w-full bg-white" />;
    }
    case "text":
      return <TextPreview url={item.url} />;
    case "link":
      return <LinkPreview url={item.url} name={item.name} />;
    default:
      return <FallbackPreview item={item} />;
  }
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(r => r.text())
      .then(t => { if (!cancelled) setText(t.slice(0, 500_000)); })
      .catch(e => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [url]);
  if (err) return <FallbackPreview item={{ id: "", name: url, url }} />;
  if (text === null) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  return (
    <pre className="h-full w-full overflow-auto p-4 text-xs leading-relaxed bg-background whitespace-pre-wrap break-words">
      {text}
    </pre>
  );
}

function LinkPreview({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setFailed(false); setLoaded(false);
    timerRef.current = window.setTimeout(() => { if (!loaded) setFailed(true); }, 3500);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (failed) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center space-y-4">
          <img src={faviconFor(url, 128)} alt="" className="h-16 w-16 mx-auto rounded" />
          <div>
            <div className="font-medium truncate">{name || hostOf(url)}</div>
            <div className="text-xs text-muted-foreground truncate">{hostOf(url)}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            This site blocks in-app previews.
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button className="gap-1"><ExternalLink className="h-4 w-4" /> Open in new tab</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title={name || url}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn("h-full w-full bg-white", !loaded && "opacity-0")}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}

function FallbackPreview({ item }: { item: PreviewItem }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="max-w-sm w-full rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <FileIcon className="h-16 w-16 mx-auto text-muted-foreground" />
        <div>
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
            .{extOf(item.name) || "file"}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">No in-app preview available for this file type.</div>
        <div className="flex gap-2 justify-center">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-1"><ExternalLink className="h-4 w-4" />Open</Button>
          </a>
          <a href={item.url} target="_blank" rel="noopener noreferrer" download={item.name}>
            <Button className="gap-1"><Download className="h-4 w-4" />Download</Button>
          </a>
        </div>
      </div>
    </div>
  );
}

import { detectKind, extOf, faviconFor, hostOf } from "@/lib/pm/previewKind";
import { FileIcon, FileText, Image as ImageIcon, Music, Video, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewItem } from "./AttachmentPreviewModal";

interface Props {
  item: PreviewItem;
  onClick?: () => void;
  className?: string;
  /** "tile" = square thumb; "row" = compact 36px round-rect leading icon */
  variant?: "tile" | "row";
}

export function AttachmentThumb({ item, onClick, className, variant = "tile" }: Props) {
  const kind = detectKind(item.name || item.url, item.type);
  const sizeCls = variant === "tile" ? "aspect-square w-full" : "h-9 w-9";

  const baseBtn = cn(
    "block rounded-md border border-border bg-muted/40 overflow-hidden relative hover:border-primary/60 transition text-left",
    sizeCls,
    className
  );

  // Image: real thumbnail
  if (kind === "image") {
    return (
      <button type="button" onClick={onClick} className={baseBtn}>
        <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
      </button>
    );
  }

  // Link: favicon
  if (kind === "link" || item.type === "link") {
    return (
      <button type="button" onClick={onClick} className={baseBtn}>
        <div className="h-full w-full flex flex-col items-center justify-center gap-1 p-2 text-center">
          <img src={faviconFor(item.url, 64)} alt="" className={variant === "tile" ? "h-8 w-8 rounded" : "h-5 w-5 rounded"} />
          {variant === "tile" && (
            <div className="text-[10px] text-muted-foreground line-clamp-1 break-all w-full">{hostOf(item.url)}</div>
          )}
        </div>
      </button>
    );
  }

  // File kinds with extension chip
  const Icon =
    kind === "video" ? Video :
    kind === "audio" ? Music :
    kind === "pdf" || kind === "office" || kind === "text" ? FileText :
    FileIcon;

  return (
    <button type="button" onClick={onClick} className={baseBtn}>
      <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground p-2 text-center gap-1">
        <Icon className={variant === "tile" ? "h-6 w-6" : "h-4 w-4"} />
        {variant === "tile" && (
          <>
            <div className="text-[10px] font-mono font-semibold uppercase">{extOf(item.name) || "file"}</div>
            <div className="text-[10px] line-clamp-2 break-all">{item.name}</div>
          </>
        )}
      </div>
    </button>
  );
}

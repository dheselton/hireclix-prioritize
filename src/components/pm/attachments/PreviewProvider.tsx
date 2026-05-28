import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { AttachmentPreviewModal, PreviewItem } from "./AttachmentPreviewModal";

interface Ctx {
  openPreview: (items: PreviewItem[], startIndex?: number) => void;
}

const PreviewCtx = createContext<Ctx | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const openPreview = useCallback((next: PreviewItem[], startIndex = 0) => {
    if (!next.length) return;
    setItems(next);
    setIndex(Math.max(0, Math.min(startIndex, next.length - 1)));
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openPreview }), [openPreview]);

  return (
    <PreviewCtx.Provider value={value}>
      {children}
      <AttachmentPreviewModal
        open={open}
        onOpenChange={setOpen}
        items={items}
        index={index}
        onIndexChange={setIndex}
      />
    </PreviewCtx.Provider>
  );
}

export function usePreview() {
  const ctx = useContext(PreviewCtx);
  if (!ctx) {
    return { openPreview: (_i: PreviewItem[], _s?: number) => {
      // eslint-disable-next-line no-console
      console.warn("usePreview() called outside <PreviewProvider> — falling back to new tab");
      const it = _i[_s ?? 0];
      if (it?.url) window.open(it.url, "_blank", "noopener,noreferrer");
    }};
  }
  return ctx;
}

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}

export function SectionShell({ title, badge, defaultOpen = true, right, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg bg-background">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 rounded-t-lg"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
          {badge}
        </span>
        <span onClick={e => e.stopPropagation()}>{right}</span>
      </button>
      <div className={cn("px-3 pb-3", !open && "hidden")}>{children}</div>
    </div>
  );
}

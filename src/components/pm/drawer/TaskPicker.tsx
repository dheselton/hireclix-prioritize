import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS } from "@/types/pm";

interface Row { id: string; title: string; status: string; project_id: string; project_title?: string; }

export function TaskPicker({ open, onClose, excludeIds, onPick }: {
  open: boolean; onClose: () => void; excludeIds: string[]; onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      let qb = supabase.from("pm_tasks").select("id,title,status,project_id").order("updated_at", { ascending: false }).limit(50);
      if (q.trim()) qb = qb.ilike("title", `%${q.trim()}%`);
      const { data } = await qb;
      const tasks = (data || []).filter((t: any) => !excludeIds.includes(t.id)) as Row[];
      const pids = Array.from(new Set(tasks.map(t => t.project_id)));
      if (pids.length) {
        const { data: ps } = await supabase.from("pm_projects").select("id,title").in("id", pids);
        const map = new Map((ps || []).map((p: any) => [p.id, p.title]));
        tasks.forEach(t => { t.project_title = map.get(t.project_id); });
      }
      setRows(tasks);
    })();
  }, [open, q, excludeIds.join(",")]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add dependency</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Search tasks by title…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-80 overflow-auto space-y-1">
          {rows.map(t => (
            <button key={t.id} onClick={() => { onPick(t.id); onClose(); }}
              className="w-full text-left px-2 py-2 rounded hover:bg-muted flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm truncate">{t.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.project_title}</div>
              </div>
              <Badge className={(STATUS_COLORS as any)[t.status] ?? ""}>{t.status.replace("_", " ")}</Badge>
            </button>
          ))}
          {!rows.length && <div className="text-xs text-muted-foreground py-4 text-center">No matching tasks.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

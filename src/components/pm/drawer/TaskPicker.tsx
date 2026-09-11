import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS } from "@/types/pm";
import { cn } from "@/lib/utils";

export interface TaskPickerRow {
  id: string;
  title: string;
  status: string;
  project_id: string;
  project_title?: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  excludeIds: string[];
  /** Multi-select confirm — preferred. Receives one or more task ids. */
  onPickMany?: (ids: string[]) => void;
  /** Legacy single-pick callback. Still supported when onPickMany is omitted. */
  onPick?: (id: string) => void;
  title?: string;
  /** When false, clicking a row immediately picks (single-select). Default true. */
  multi?: boolean;
};

export function TaskPicker({
  open,
  onClose,
  excludeIds,
  onPickMany,
  onPick,
  title = "Add dependency",
  multi = true,
}: Props) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<TaskPickerRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setQ("");
      return;
    }
    (async () => {
      let qb = supabase
        .from("pm_tasks")
        .select("id,title,status,project_id")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (q.trim()) qb = qb.ilike("title", `%${q.trim()}%`);
      const { data } = await qb;
      const tasks = (data || []).filter((t: any) => !excludeIds.includes(t.id)) as TaskPickerRow[];
      const pids = Array.from(new Set(tasks.map((t) => t.project_id)));
      if (pids.length) {
        const { data: ps } = await supabase.from("pm_projects").select("id,title").in("id", pids);
        const map = new Map((ps || []).map((p: any) => [p.id, p.title]));
        tasks.forEach((t) => {
          t.project_title = map.get(t.project_id);
        });
      }
      setRows(tasks);
    })();
  }, [open, q, excludeIds.join(",")]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (onPickMany) onPickMany(ids);
    else if (onPick) ids.forEach((id) => onPick(id));
    onClose();
  }

  function pickOne(id: string) {
    if (onPickMany) onPickMany([id]);
    else onPick?.(id);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] !flex !flex-col !overflow-hidden gap-3 p-0 sm:p-0">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6 shrink-0 space-y-3">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Search tasks by title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-6 space-y-1">
          {rows.map((t) => {
            const checked = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => (multi ? toggle(t.id) : pickOne(t.id))}
                className={cn(
                  "w-full text-left px-2 py-2 rounded hover:bg-muted flex items-start gap-2",
                  checked && "bg-muted",
                )}
              >
                {multi && (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(t.id)}
                    className="mt-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug break-words whitespace-normal">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                    {t.project_title}
                  </div>
                  <Badge
                    className={cn(
                      "mt-1 text-[10px] capitalize",
                      (STATUS_COLORS as any)[t.status] ?? "",
                    )}
                  >
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </button>
            );
          })}
          {!rows.length && (
            <div className="text-xs text-muted-foreground py-4 text-center">No matching tasks.</div>
          )}
        </div>
        {multi && (
          <DialogFooter className="px-4 pb-4 sm:px-6 sm:pb-6 shrink-0 border-t pt-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!selected.size}>
              Add {selected.size ? `(${selected.size})` : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

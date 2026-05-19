import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item { id: string; task_id: string; label: string; checked: boolean; sort_order: number; }

export function QuickChecklist({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");

  async function load() {
    const { data } = await supabase.from("pm_checklist_items").select("*").eq("task_id", taskId).order("sort_order");
    setItems((data || []) as Item[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function add() {
    const label = draft.trim();
    if (!label) return;
    const sort_order = (items[items.length - 1]?.sort_order ?? 0) + 10;
    await supabase.from("pm_checklist_items").insert({ task_id: taskId, label, sort_order, checked: false } as any);
    setDraft("");
    await load();
  }
  async function toggle(s: Item) {
    await supabase.from("pm_checklist_items").update({ checked: !s.checked } as any).eq("id", s.id);
    await load();
  }
  async function remove(id: string) {
    await supabase.from("pm_checklist_items").delete().eq("id", id);
    await load();
  }

  const done = items.filter(i => i.checked).length;

  return (
    <div className="rounded-lg border-2 border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Checklist
        </h3>
        {items.length > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{done}/{items.length}</span>
        )}
      </div>
      <div className="space-y-1">
        {items.map(s => (
          <div key={s.id} className="group flex items-center gap-2 py-0.5">
            <Checkbox checked={s.checked} onCheckedChange={() => toggle(s)} />
            <button
              type="button"
              onClick={() => toggle(s)}
              className={cn(
                "flex-1 text-left text-sm",
                s.checked && "line-through text-muted-foreground"
              )}
            >{s.label}</button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-destructive"
              onClick={() => remove(s.id)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {!items.length && <div className="text-xs text-muted-foreground italic py-1">No items yet.</div>}
      </div>
      <div className="flex gap-1.5 mt-2">
        <Input
          placeholder="Add item…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          className="h-7 text-xs"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-background hover:border-primary"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

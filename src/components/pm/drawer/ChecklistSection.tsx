import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowUp, ArrowDown, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item { id: string; task_id: string; label: string; checked: boolean; sort_order: number; }

export function ChecklistSection({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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
  async function rename(id: string, label: string) {
    await supabase.from("pm_checklist_items").update({ label } as any).eq("id", id);
    setEditingId(null);
    await load();
  }
  async function remove(id: string) {
    await supabase.from("pm_checklist_items").delete().eq("id", id);
    await load();
  }
  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    await Promise.all([
      supabase.from("pm_checklist_items").update({ sort_order: b.sort_order } as any).eq("id", a.id),
      supabase.from("pm_checklist_items").update({ sort_order: a.sort_order } as any).eq("id", b.id),
    ]);
    await load();
  }

  const done = items.filter(i => i.checked).length;
  const allDone = items.length > 0 && done === items.length;

  return (
    <SectionShell
      title="Checklist"
      badge={
        <span className="flex items-center gap-1">
          <Badge variant="secondary" className="ml-1">{done}/{items.length}</Badge>
          {allDone && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
              <CheckCircle2 className="h-3 w-3" /> All done
            </Badge>
          )}
        </span>
      }
    >
      <div className="space-y-1">
        {items.map((s, i) => (
          <div key={s.id} className="group flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/40">
            <Checkbox checked={s.checked} onCheckedChange={() => toggle(s)} />
            {editingId === s.id ? (
              <Input autoFocus value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => rename(s.id, editValue || s.label)}
                onKeyDown={e => { if (e.key === "Enter") rename(s.id, editValue || s.label); if (e.key === "Escape") setEditingId(null); }}
                className="h-7" />
            ) : (
              <button
                className={cn("flex-1 text-left text-sm", s.checked && "line-through text-muted-foreground")}
                onClick={() => { setEditingId(s.id); setEditValue(s.label); }}
              >{s.label}</button>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
        {!items.length && <div className="text-xs text-muted-foreground italic py-1">No checklist items yet.</div>}
      </div>
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="Add checklist item…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          className="h-8"
        />
        <Button size="sm" onClick={add}><Plus className="h-3 w-3" /></Button>
      </div>
    </SectionShell>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ExternalLink, Trash2, ListTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusPill } from "@/components/pm/StatusPill";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { InlineDatePopover } from "@/components/pm/project/board/InlineDatePopover";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { createTask, updateTask, deleteTask } from "@/lib/pm/api";
import { emitTasksChanged, useTasksChanged } from "@/lib/pm/refresh";
import { isDone, type PmTask } from "@/types/pm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Real sub-tasks: child `pm_tasks` rows linked by `parent_task_id`.
 * Unlike the Quick Checklist these are full tasks — assignable, schedulable,
 * time-trackable, and openable in their own workspace.
 */
export function SubtasksSection({ task }: { task: PmTask }) {
  const [children, setChildren] = useState<PmTask[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("pm_tasks")
      .select("*")
      .eq("parent_task_id", task.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setChildren((data || []) as unknown as PmTask[]);
  }, [task.id]);

  useEffect(() => { load(); }, [load]);
  useTasksChanged(() => { load(); });

  async function add() {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createTask({
        project_id: task.project_id,
        parent_task_id: task.id,
        phase_id: task.phase_id ?? null,
        title,
        type: task.type,
        status: "claimed",
        priority: task.priority,
        assignee_id: task.assignee_id ?? null,
        due_date: task.due_date ?? null,
        sort_order: (children[children.length - 1]?.sort_order ?? 0) + 10,
      } as Partial<PmTask>);
      setDraft("");
      toast.success("Sub-task added");
      await load();
    } catch {
      toast.error("Couldn't add sub-task");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(child: PmTask) {
    const next: PmTask["status"] = isDone(child.status) ? "in_progress" : "complete";
    try {
      await updateTask(child.id, { status: next });
      emitTasksChanged();
      await load();
    } catch {
      toast.error("Couldn't update sub-task");
    }
  }

  async function setDue(child: PmTask, iso: string | null) {
    try {
      await updateTask(child.id, { due_date: iso });
      await load();
    } catch {
      toast.error("Couldn't update due date");
    }
  }

  async function remove(id: string) {
    try {
      await deleteTask(id);
      toast.success("Sub-task deleted");
      emitTasksChanged();
      await load();
    } catch {
      toast.error("Couldn't delete sub-task");
    } finally {
      setConfirmId(null);
    }
  }

  const done = children.filter(c => isDone(c.status)).length;

  return (
    <div className="rounded-lg border-2 border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <ListTree className="h-3.5 w-3.5" /> Sub-tasks
        </h3>
        {children.length > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{done}/{children.length} done</span>
        )}
      </div>

      <div className="space-y-1">
        {children.map(c => (
          <div
            key={c.id}
            className="group flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
          >
            <Checkbox
              checked={isDone(c.status)}
              onCheckedChange={() => toggle(c)}
              aria-label="Toggle sub-task complete"
            />
            <Link
              to={`/pm/tasks/${c.id}`}
              className={cn(
                "flex-1 min-w-0 truncate text-sm hover:underline",
                isDone(c.status) && "line-through text-muted-foreground",
              )}
            >
              {c.title}
            </Link>
            <StatusPill status={c.status} className="text-[10px] py-0 px-1.5 hidden sm:inline-flex" />
            <InlineDatePopover value={c.due_date} onChange={iso => setDue(c, iso)} />
            <MultiAssigneeChip taskId={c.id} primaryId={c.assignee_id} size="xs" onChanged={load} />
            <Link
              to={`/pm/tasks/${c.id}`}
              className="text-muted-foreground hover:text-foreground"
              title="Open sub-task"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-destructive transition"
              onClick={() => setConfirmId(c.id)}
              title="Delete sub-task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!children.length && (
          <p className="text-xs text-muted-foreground italic py-1">
            No sub-tasks yet. Break this work into assignable pieces below.
          </p>
        )}
      </div>

      <div className="flex gap-1.5 mt-3">
        <Input
          placeholder="Add a sub-task…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          className="h-8 text-sm"
        />
        <Button size="sm" className="h-8" onClick={add} disabled={!draft.trim() || adding}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={o => { if (!o) setConfirmId(null); }}
        title="Delete this sub-task?"
        description="The sub-task and its data will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmId && remove(confirmId)}
      />
    </div>
  );
}

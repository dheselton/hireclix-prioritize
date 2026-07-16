import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { Button } from "@/components/ui/button";
import { Plus, X, Star } from "lucide-react";
import { useMockUsers } from "@/lib/pm/mockUser";
import { TASK_STATUSES, PRIORITIES, type PmTask, type TaskStatus, type TaskPriority } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { combineAssignees, removeAssignee, useInvalidateAssignees, useTaskCoAssignees } from "@/lib/pm/assignees";
import { TeamsMultiSelect } from "@/components/pm/TeamsMultiSelect";
import { teamsFromTask, type Team } from "@/lib/pm/teams";
import { TagPicker } from "@/components/pm/tags/TagPicker";
import { getKindStatusLabel, getTaskKind } from "@/lib/pm/taskKind";

function statusClass(s: TaskStatus) {
  if (s === "blocked") return "bg-destructive/15 text-destructive border-destructive/30";
  if (s === "complete" || s === "approved") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (s === "in_progress" || s === "in_review") return "bg-primary/15 text-primary border-primary/30";
  if (s === "claimed") return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}
function priorityClass(p: TaskPriority) {
  if (p === "urgent") return "bg-destructive/15 text-destructive border-destructive/30";
  if (p === "high") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (p === "medium") return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-[13px] font-semibold text-right min-w-0">{children}</div>
    </div>
  );
}

export function ControlPanel({
  task,
  setTask,
  patch,
}: {
  task: PmTask;
  setTask: (t: PmTask) => void;
  patch: (p: Partial<PmTask>) => Promise<void>;
}) {
  // Refetch the task row after assignee changes — addAssignee may promote a user to primary
  // (writes pm_tasks.assignee_id directly), so the local task state needs to resync.
  async function refetchAssignee() {
    const { data } = await supabase.from("pm_tasks").select("assignee_id").eq("id", task.id).maybeSingle();
    const next = (data as any)?.assignee_id ?? null;
    if (next !== task.assignee_id) setTask({ ...task, assignee_id: next });
  }
  const showEnv = task.type === "dev" || !!task.dev_environment;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Control Panel
      </h3>

      {/* Status */}
      <Row label="Status">
        <Select value={task.status} onValueChange={(v: TaskStatus) => patch({ status: v })}>
          <SelectTrigger className={cn("h-7 px-2 py-0 text-xs font-semibold border rounded-full w-auto gap-1.5", statusClass(task.status))}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {TASK_STATUSES.map(s => {
              const kind = getTaskKind(task);
              const label = kind !== "task" ? getKindStatusLabel(s, kind) : s.replace(/_/g, " ");
              return <SelectItem key={s} value={s}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </Row>

      {/* Priority */}
      <Row label="Priority">
        <Select value={task.priority} onValueChange={(v: TaskPriority) => patch({ priority: v })}>
          <SelectTrigger className={cn("h-7 px-2 py-0 text-xs font-semibold border rounded-full w-auto gap-1.5 capitalize", priorityClass(task.priority))}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>

      {/* Assignees */}
      <Row label="Assignees">
        <AssigneeChips taskId={task.id} primaryId={task.assignee_id} onChanged={refetchAssignee} />
      </Row>

      {/* Teams */}
      <Row label="Teams">
        <TeamsMultiSelect
          value={teamsFromTask(task)}
          onChange={(next: Team[]) => patch({ teams: next })}
        />
      </Row>

      {/* Due Date */}
      <Row label="Due Date">
        <DatePicker
          value={task.due_date}
          onChange={v => patch({ due_date: v ?? null })}
          size="sm"
        />
      </Row>

      {/* Tags */}
      <Row label="Tags">
        <div className="flex justify-end">
          <TagPicker
            value={task.tags ?? []}
            onChange={(next) => patch({ tags: next })}
            readOnlyInherited
            editableNamespaces={["feature", "type"]}
            placeholder="Tag"
          />
        </div>
      </Row>

      {showEnv && (
        <Row label="Environment">
          <Input
            value={task.dev_environment ?? ""}
            onChange={e => setTask({ ...task, dev_environment: e.target.value })}
            onBlur={e => patch({ dev_environment: e.target.value })}
            placeholder="staging.acme.com"
            className="h-7 w-40 text-xs text-right"
          />
        </Row>
      )}
    </div>
  );
}

function AssigneeChips({ taskId, primaryId, onChanged }: { taskId: string; primaryId: string | null; onChanged?: () => void | Promise<void> }) {
  const users = useMockUsers();
  const co = useTaskCoAssignees(taskId);
  const all = combineAssignees(primaryId, co);
  const invalidate = useInvalidateAssignees();

  async function remove(uid: string) {
    await removeAssignee(taskId, uid);
    invalidate();
    await onChanged?.();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {all.length === 0 && (
        <span className="text-muted-foreground italic font-normal text-xs">Unassigned</span>
      )}
      {all.map(uid => {
        const u = users.find(x => x.id === uid);
        if (!u) return null;
        const isPrimary = uid === primaryId;
        return (
          <span
            key={uid}
            className={cn(
              "inline-flex items-center gap-1 pl-1 pr-1 py-0.5 rounded-full border text-xs",
              isPrimary ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/40"
            )}
            title={isPrimary ? `${u.name} (primary)` : u.name}
          >
            <UserAvatar userId={uid} size="xs" />
            <span className="font-medium max-w-[80px] truncate">{u.name.split(" ")[0]}</span>
            {isPrimary && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />}
            <button
              type="button"
              onClick={() => remove(uid)}
              aria-label={`Remove ${u.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <AssigneePopover
        taskId={taskId}
        assigneeId={primaryId}
        mode="multi"
        onChanged={onChanged}
        trigger={
          <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
            <Plus className="h-3 w-3" />
          </Button>
        }
      />
    </div>
  );
}

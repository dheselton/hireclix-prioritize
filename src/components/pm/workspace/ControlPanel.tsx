import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { TASK_STATUSES, PRIORITIES, type PmTask, type TaskStatus, type TaskPriority } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";

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
  const users = useMockUsers();
  const assignee = users.find(u => u.id === task.assignee_id);
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
            {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
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

      {/* Assignee */}
      <Row label="Assignee">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1.5 hover:underline">
              {assignee ? (
                <>
                  <UserAvatar userId={assignee.id} size="xs" />
                  <span>{assignee.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground italic font-normal">Unassigned</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 z-50 bg-popover">
            <button
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded text-muted-foreground"
              onClick={() => patch({ assignee_id: null })}
            >
              Unassigned
            </button>
            {users.filter(u => u.role !== "submitter").map(u => (
              <button
                key={u.id}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center gap-2"
                onClick={() => patch({ assignee_id: u.id })}
              >
                <UserAvatar userId={u.id} size="xs" />
                {u.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </Row>

      {/* Due Date */}
      <Row label="Due Date">
        <DatePicker
          value={task.due_date}
          onChange={v => patch({ due_date: v ?? null })}
          size="sm"
        />
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

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useMockUsers } from "@/lib/pm/mockUser";
import { TASK_STATUSES, PRIORITIES, type PmTask, type TaskStatus, type TaskPriority } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { emitTaskDateProposed } from "@/lib/pm/refresh";
import { Clock } from "lucide-react";

function fmtDur(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
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
  const [client, setClient] = useState<string>("");
  const [totalMinutes, setTotalMinutes] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: proj } = await supabase
        .from("pm_projects")
        .select("client_id, clients(name)")
        .eq("id", task.project_id)
        .maybeSingle();
      setClient((proj as any)?.clients?.name ?? "—");
    })();
  }, [task.project_id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("pm_time_entries").select("minutes").eq("task_id", task.id);
      setTotalMinutes((data || []).reduce((s: number, e: any) => s + (e.minutes || 0), 0));
    })();
  }, [task.id]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={task.status} onValueChange={(v: TaskStatus) => patch({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Assignee</Label>
          <Select value={task.assignee_id ?? "none"} onValueChange={v => patch({ assignee_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              <SelectItem value="none">Unassigned</SelectItem>
              {users.filter(u => u.role !== "submitter").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Priority</Label>
          <Select value={task.priority} onValueChange={(v: TaskPriority) => patch({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Start</Label>
            <DatePicker value={task.start_date} onChange={v => {
              if (!v) { patch({ start_date: v }); return; }
              const dur = Math.max(1, task.duration_days || 1);
              const startD = new Date(v + "T00:00:00");
              const endD = new Date(startD.getTime() + (dur - 1) * 86400000);
              const end = endD.toISOString().slice(0, 10);
              setTask({ ...task, start_date: v, due_date: end });
              emitTaskDateProposed({ taskId: task.id, start: v, end });
            }} />
          </div>
          <div>
            <Label className="text-xs">Due</Label>
            <DatePicker value={task.due_date} onChange={v => {
              if (!v) { patch({ due_date: v }); return; }
              const dur = Math.max(1, task.duration_days || 1);
              const endD = new Date(v + "T00:00:00");
              const startD = new Date(endD.getTime() - (dur - 1) * 86400000);
              const start = startD.toISOString().slice(0, 10);
              setTask({ ...task, start_date: start, due_date: v });
              emitTaskDateProposed({ taskId: task.id, start, end: v });
            }} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Duration (days)</Label>
          <Input type="number" min={1} value={task.duration_days}
            onChange={e => setTask({ ...task, duration_days: Number(e.target.value) })}
            onBlur={e => patch({ duration_days: Number(e.target.value) })} />
        </div>

        <div className="border-t border-border pt-3 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="font-medium">{client}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Time logged</span>
            <span className="font-medium tabular-nums">{fmtDur(totalMinutes)}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{fmtDate(task.created_at?.slice(0, 10))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{fmtDate(task.updated_at?.slice(0, 10))}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { createTask } from "@/lib/pm/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TASK_TYPES, PRIORITIES,
  type PmProject, type PmPhase, type PmRole, type TaskType, type TaskPriority,
} from "@/types/pm";
import { TYPE_COLORS } from "@/types/pm";

const ROLE_DEFAULT_TYPE: Record<PmRole, TaskType> = {
  pm: "review",
  designer: "design",
  developer: "dev",
  qa: "qa",
  strategist: "strategy",
  analyst: "analytics",
  csm: "review",
  support: "review",
  submitter: "review",
};

const TYPE_LABEL: Record<TaskType, string> = {
  design: "Design",
  dev: "Dev",
  review: "Review",
  approval: "Approval",
  content: "Content",
  qa: "QA",
  strategy: "Strategy",
  research: "Research",
  analytics: "Analytics",
  reporting: "Reporting",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PmProject;
  phases: PmPhase[];
  meId: string | null;
  meRole: PmRole | null;
  onCreated?: () => void;
}

export function NewTaskDialog({ open, onOpenChange, project, phases, meId, meRole, onCreated }: Props) {
  const users = useMockUsers();
  const defaultType: TaskType = meRole ? ROLE_DEFAULT_TYPE[meRole] : "design";

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>(defaultType);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(meId);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setType(defaultType);
      setPriority("medium");
      setAssigneeId(meId);
      setPhaseId(null);
      setDueDate(undefined);
    }
  }, [open, defaultType, meId]);

  const assignee = useMemo(() => users.find(u => u.id === assigneeId) ?? null, [users, assigneeId]);

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createTask({
        project_id: project.id,
        phase_id: phaseId,
        title: title.trim(),
        type,
        status: assigneeId ? "claimed" : "unclaimed",
        priority,
        assignee_id: assigneeId,
        duration_days: 1,
        sort_order: 9999,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      });
      toast.success("Task created");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast.error("Couldn't create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="new-task-title">Title</Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                      {TYPE_LABEL[type]}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {TASK_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                        {TYPE_LABEL[t]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <AssigneePopover
                controlled
                assigneeId={assigneeId}
                onPick={(id) => setAssigneeId(id)}
                trigger={
                  <Button type="button" variant="outline" className="w-full justify-start gap-2 h-9">
                    {assignee ? (
                      <>
                        <UserAvatar user={assignee} size="xs" />
                        <span className="truncate">{assignee.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </Button>
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal h-9", !dueDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "MM/dd/yyyy") : <span>None</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>Clear</Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {phases.length > 0 && (
            <div className="space-y-1.5">
              <Label>Phase</Label>
              <Select value={phaseId ?? "__none"} onValueChange={v => setPhaseId(v === "__none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="__none">No phase</SelectItem>
                  {phases.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

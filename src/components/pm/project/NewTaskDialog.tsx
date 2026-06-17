import { useEffect, useMemo, useState } from "react";
import { format, addBusinessDays, subBusinessDays, differenceInBusinessDays } from "date-fns";
import { CalendarIcon, Plus, Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { TeamsMultiSelect } from "@/components/pm/TeamsMultiSelect";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { createTask } from "@/lib/pm/api";
import { addAssignee } from "@/lib/pm/assignees";
import { DEFAULT_TEAMS_FOR_TYPE, type Team } from "@/lib/pm/teams";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TASK_TYPES, TASK_STATUSES, PRIORITIES,
  type PmProject, type PmPhase, type PmRole, type TaskType, type TaskStatus, type TaskPriority,
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
  design: "Design", dev: "Dev", review: "Review", approval: "Approval", content: "Content",
  qa: "QA", strategy: "Strategy", research: "Research", analytics: "Analytics", reporting: "Reporting",
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

function teamsForTypes(types: TaskType[]): Team[] {
  const set = new Set<Team>();
  for (const t of types) for (const team of DEFAULT_TEAMS_FOR_TYPE[t] ?? []) set.add(team);
  return Array.from(set);
}

export function NewTaskDialog({ open, onOpenChange, project, phases, meId, meRole, onCreated }: Props) {
  const users = useMockUsers();
  const defaultType: TaskType = meRole ? ROLE_DEFAULT_TYPE[meRole] : "design";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [types, setTypes] = useState<TaskType[]>([defaultType]);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>(meId ? "claimed" : "unclaimed");
  const [statusDirty, setStatusDirty] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(meId ? [meId] : []);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [duration, setDuration] = useState<string>("1");
  const [teams, setTeams] = useState<Team[]>(teamsForTypes([defaultType]));
  const [teamsDirty, setTeamsDirty] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [devEnv, setDevEnv] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setTypes([defaultType]);
    setPriority("medium");
    setStatus(meId ? "claimed" : "unclaimed");
    setStatusDirty(false);
    setAssigneeIds(meId ? [meId] : []);
    setPhaseId(null);
    setStartDate(undefined);
    setDueDate(undefined);
    setDuration("1");
    setTeams(teamsForTypes([defaultType]));
    setTeamsDirty(false);
    setTagsInput("");
    setDevEnv("");
  }, [open, defaultType, meId]);

  // Auto-sync status with assignees unless user touched it
  useEffect(() => {
    if (statusDirty) return;
    setStatus(assigneeIds.length > 0 ? "claimed" : "unclaimed");
  }, [assigneeIds, statusDirty]);

  // Auto-sync teams with types unless user touched it
  useEffect(() => {
    if (teamsDirty) return;
    setTeams(teamsForTypes(types));
  }, [types, teamsDirty]);

  const primaryType = types[0];
  const remainingTypes = useMemo(() => TASK_TYPES.filter(t => !types.includes(t)), [types]);

  function addType(t: TaskType) {
    if (types.includes(t)) return;
    setTypes([...types, t]);
  }
  function removeType(t: TaskType) {
    if (types.length <= 1) return;
    setTypes(types.filter(x => x !== t));
  }
  function promoteType(t: TaskType) {
    if (!types.includes(t) || types[0] === t) return;
    setTypes([t, ...types.filter(x => x !== t)]);
  }

  function addAssigneeId(uid: string | null) {
    if (!uid || assigneeIds.includes(uid)) return;
    setAssigneeIds([...assigneeIds, uid]);
  }
  function removeAssigneeId(uid: string) {
    setAssigneeIds(assigneeIds.filter(x => x !== uid));
  }
  function promoteAssignee(uid: string) {
    if (!assigneeIds.includes(uid) || assigneeIds[0] === uid) return;
    setAssigneeIds([uid, ...assigneeIds.filter(x => x !== uid)]);
  }

  // Bidirectional sync: Start ⇄ Duration ⇄ Due, whole business days only (weekends excluded).
  // 1 day means start === due.
  function parseDur(s: string): number {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function durToOffset(s: string): number {
    return Math.max(1, parseDur(s)) - 1;
  }
  function handleStartChange(d: Date | undefined) {
    setStartDate(d);
    if (!d) return;
    if (dueDate) {
      const diff = differenceInBusinessDays(dueDate, d) + 1;
      if (diff >= 1) setDuration(String(diff));
      else setDueDate(addBusinessDays(d, durToOffset(duration)));
    } else {
      setDueDate(addBusinessDays(d, durToOffset(duration)));
    }
  }
  function handleDueChange(d: Date | undefined) {
    setDueDate(d);
    if (!d) return;
    if (startDate) {
      const diff = differenceInBusinessDays(d, startDate) + 1;
      if (diff >= 1) setDuration(String(diff));
      else setStartDate(subBusinessDays(d, durToOffset(duration)));
    } else {
      setStartDate(subBusinessDays(d, durToOffset(duration)));
    }
  }
  function handleDurationChange(v: string) {
    setDuration(v);
    if (!v.trim()) return;
    const off = durToOffset(v);
    if (startDate) setDueDate(addBusinessDays(startDate, off));
    else if (dueDate) setStartDate(subBusinessDays(dueDate, off));
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const userTags = tagsInput.split(",").map(s => s.trim()).filter(Boolean);
      const extraTypeTags = types.slice(1).map(t => `type:${t}`);
      const allTags = Array.from(new Set([...userTags, ...extraTypeTags]));
      const dur = Math.max(0.5, parseFloat(duration) || 1);

      const created = await createTask({
        project_id: project.id,
        phase_id: phaseId,
        title: title.trim(),
        description: description.trim() || null,
        type: primaryType,
        status,
        priority,
        assignee_id: assigneeIds[0] ?? null,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        duration_days: dur,
        teams,
        tags: allTags,
        dev_environment: types.includes("dev") ? (devEnv.trim() || null) : null,
        sort_order: 9999,
      });

      // Persist co-assignees
      for (const uid of assigneeIds.slice(1)) {
        await addAssignee(created.id, uid);
      }

      toast.success("Task created");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title */}
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

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="new-task-desc">Description</Label>
            <Textarea
              id="new-task-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional details, context, links…"
              rows={3}
            />
          </div>

          {/* Type (multi) + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type {types.length > 1 && <span className="text-xs text-muted-foreground font-normal">(first = primary)</span>}</Label>
              <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-background px-2 py-1.5">
                {types.map((t, i) => {
                  const isPrimary = i === 0;
                  return (
                    <span
                      key={t}
                      className={cn(
                        "inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border text-xs",
                        isPrimary ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/40 cursor-pointer hover:bg-muted",
                      )}
                      onClick={() => !isPrimary && promoteType(t)}
                      title={isPrimary ? `${TYPE_LABEL[t]} (primary)` : `Click to make ${TYPE_LABEL[t]} primary`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                      <span className="font-medium">{TYPE_LABEL[t]}</span>
                      {isPrimary && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />}
                      {types.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeType(t); }}
                          aria-label={`Remove ${TYPE_LABEL[t]}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
                {remainingTypes.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-44 p-1 z-50 bg-popover">
                      {remainingTypes.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => addType(t)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
                          {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
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

          {/* Status + Phase */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={v => { setStatus(v as TaskStatus); setStatusDirty(true); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {TASK_STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Phase</Label>
              <Select
                value={phaseId ?? "__none"}
                onValueChange={v => setPhaseId(v === "__none" ? null : v)}
                disabled={phases.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="No phase" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="__none">No phase</SelectItem>
                  {phases.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignees (multi) */}
          <div className="space-y-1.5">
            <Label>Assignees {assigneeIds.length > 1 && <span className="text-xs text-muted-foreground font-normal">(first = primary)</span>}</Label>
            <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-background px-2 py-1.5">
              {assigneeIds.length === 0 && (
                <span className="text-xs italic text-muted-foreground">Unassigned</span>
              )}
              {assigneeIds.map((uid, i) => {
                const u = users.find(x => x.id === uid);
                if (!u) return null;
                const isPrimary = i === 0;
                return (
                  <span
                    key={uid}
                    className={cn(
                      "inline-flex items-center gap-1 pl-1 pr-1 py-0.5 rounded-full border text-xs",
                      isPrimary ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/40 cursor-pointer hover:bg-muted",
                    )}
                    onClick={() => !isPrimary && promoteAssignee(uid)}
                    title={isPrimary ? `${u.name} (primary)` : `Click to make ${u.name} primary`}
                  >
                    <UserAvatar userId={uid} size="xs" />
                    <span className="font-medium max-w-[100px] truncate">{u.name}</span>
                    {isPrimary && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeAssigneeId(uid); }}
                      aria-label={`Remove ${u.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              <AssigneePopover
                controlled
                assigneeId={null}
                onPick={(id) => addAssigneeId(id)}
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                    <Plus className="h-3 w-3" />
                  </Button>
                }
              />
            </div>
          </div>

          {/* Teams */}
          <div className="space-y-1.5">
            <Label>Teams</Label>
            <div className="rounded-md border border-input bg-background px-2 py-1.5 min-h-9">
              <TeamsMultiSelect
                value={teams}
                onChange={(next) => { setTeams(next); setTeamsDirty(true); }}
                align="start"
              />
            </div>
          </div>

          {/* Start + Due */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <DateField value={startDate} onChange={handleStartChange} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <DateField value={dueDate} onChange={handleDueChange} />
            </div>
          </div>

          {/* Duration + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-task-dur">Duration (business days)</Label>
              <Input
                id="new-task-dur"
                type="number"
                min={0.5}
                step={0.5}
                value={duration}
                onChange={e => handleDurationChange(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Syncs with Start &amp; Due (weekends excluded).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-task-tags">Tags <span className="text-xs text-muted-foreground font-normal">(comma-separated)</span></Label>
              <Input
                id="new-task-tags"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="urgent, q4, launch"
              />
            </div>
          </div>

          {/* Dev environment (conditional) */}
          {types.includes("dev") && (
            <div className="space-y-1.5">
              <Label htmlFor="new-task-env">Dev environment</Label>
              <Input
                id="new-task-env"
                value={devEnv}
                onChange={e => setDevEnv(e.target.value)}
                placeholder="staging.acme.com"
              />
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

function DateField({ value, onChange }: { value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal h-9", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "MM/dd/yyyy") : <span>None</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={(d) => { const w = d.getDay(); return w === 0 || w === 6; }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(undefined)}>Clear</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

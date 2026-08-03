import { useEffect, useMemo, useState } from "react";
import { format, addBusinessDays, subBusinessDays, differenceInBusinessDays } from "date-fns";
import { CalendarIcon, Plus, Star, X, ChevronDown, ChevronRight, Trash2, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { TeamsMultiSelect } from "@/components/pm/TeamsMultiSelect";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { createTask, persistIntakeAttachments } from "@/lib/pm/api";
import { addAssignee } from "@/lib/pm/assignees";
import { watchTask } from "@/lib/pm/watchers";
import { DEFAULT_TEAMS_FOR_TYPE, type Team } from "@/lib/pm/teams";
import { REVEAL_MODE_SHORT } from "@/lib/pm/reveal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TagPicker } from "@/components/pm/tags/TagPicker";
import { IntakeAttachmentsField, type StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";
import { TaskPicker } from "@/components/pm/drawer/TaskPicker";
import {
  TASK_TYPES, TASK_STATUSES, PRIORITIES,
  type PmProject, type PmPhase, type PmRole, type TaskType, type TaskStatus, type TaskPriority, type RevealMode,
} from "@/types/pm";
import { TYPE_COLORS, STATUS_COLORS } from "@/types/pm";
import { KIND_META, TASK_KINDS, type TaskKind } from "@/lib/pm/taskKind";

const MORE_OPEN_KEY = "pm:newTaskDialog:moreOpen";
interface DepPick { id: string; title: string; status: string; project_title?: string }

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
  ba: "review",
  tech_lead: "dev",
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
  /** When true, prefills tags + custom_fields so this task is treated as a
   *  Support request (lives in the support board, not the build archive). */
  initialSupport?: boolean;
  /** Pre-select the kind (Decision / Risk) so the dialog opens in RAID mode. */
  initialKind?: TaskKind;
}

function teamsForTypes(types: TaskType[]): Team[] {
  const set = new Set<Team>();
  for (const t of types) for (const team of DEFAULT_TEAMS_FOR_TYPE[t] ?? []) set.add(team);
  return Array.from(set);
}

export function NewTaskDialog({ open, onOpenChange, project, phases, meId, meRole, onCreated, initialSupport, initialKind }: Props) {
  const users = useMockUsers();
  const { user } = useCurrentUser();
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
  const [tags, setTags] = useState<string[]>([]);
  const [devEnv, setDevEnv] = useState("");
  const [saving, setSaving] = useState(false);

  // "More options" state
  const [moreOpen, setMoreOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(MORE_OPEN_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MORE_OPEN_KEY, moreOpen ? "1" : "0");
  }, [moreOpen]);

  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<StagedLink[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [deps, setDeps] = useState<DepPick[]>([]);
  const [depPickerOpen, setDepPickerOpen] = useState(false);
  const [revealMode, setRevealMode] = useState<RevealMode>("on_complete");
  const [watcherIds, setWatcherIds] = useState<string[]>([]);
  const [estimateHours, setEstimateHours] = useState<string>("");
  const [kind, setKind] = useState<TaskKind>(initialKind ?? "task");

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
    setTags([]);
    setDevEnv("");
    setFiles([]);
    setLinks([]);
    setChecklist([]);
    setChecklistDraft("");
    setDeps([]);
    setRevealMode("on_complete");
    setWatcherIds([]);
    setEstimateHours("");
    setKind(initialKind ?? "task");
  }, [open, defaultType, meId, initialSupport, initialKind]);

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
      const extraTypeTags = types.slice(1).map(t => `type:${t}`);
      const supportFlag = initialSupport ? ['support'] : [];
      const allTags = Array.from(new Set([...tags, ...extraTypeTags, ...supportFlag]));
      const dur = Math.max(1, parseInt(duration, 10) || 1);

      const estNum = parseFloat(estimateHours);
      const custom: Record<string, any> = {};
      if (Number.isFinite(estNum) && estNum > 0) custom.estimated_hours = estNum;
      if (kind !== "task") custom.kind = kind;

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
        ...(Object.keys(custom).length ? { custom_fields: custom } : {}),
      });

      // The task itself exists from here on. Sub-steps below are best-effort:
      // collect what failed so the toast tells the truth instead of claiming
      // a clean save (or worse, claiming the task failed).
      const subFailures: string[] = [];

      // Co-assignees
      if (assigneeIds.length > 1) {
        try {
          for (const uid of assigneeIds.slice(1)) {
            await addAssignee(created.id, uid);
          }
        } catch (err) { console.error("co-assignees failed", err); subFailures.push("co-assignees"); }
      }

      // Attachments + links (files → task-attachments bucket, links → pm_task_links)
      if (files.length || links.length) {
        try {
          await persistIntakeAttachments({
            projectId: project.id,
            taskId: created.id,
            files,
            links,
            userId: user?.id ?? null,
          });
        } catch (err) {
          console.error("attachments failed", err);
          subFailures.push(files.length && links.length ? "attachments and links" : files.length ? "attachments" : "links");
        }
      }

      // Checklist
      if (checklist.length) {
        try {
          const { error } = await supabase.from("pm_checklist_items").insert(
            checklist.map((label, i) => ({
              task_id: created.id, label, sort_order: i, checked: false,
            })) as any
          );
          if (error) throw error;
        } catch (err) { console.error("checklist failed", err); subFailures.push("checklist"); }
      }

      // Dependencies (this task is blocked by picked tasks)
      if (deps.length) {
        try {
          const { error } = await supabase.from("pm_task_dependencies").insert(
            deps.map(d => ({
              task_id: created.id,
              depends_on_task_id: d.id,
              type: "finish_start",
              lag_days: 0,
              reveal_mode: revealMode,
            })) as any
          );
          if (error) throw error;
        } catch (err) { console.error("deps failed", err); subFailures.push("dependencies"); }
      }

      // Watchers — one entry in the failure list even if several calls fail.
      if (watcherIds.length) {
        let watcherFailed = false;
        for (const uid of watcherIds) {
          try { await watchTask(uid, created.id); } catch (err) { console.error(err); watcherFailed = true; }
        }
        if (watcherFailed) subFailures.push("watchers");
      }

      if (subFailures.length) {
        toast.warning(`Task created, but some details didn't save: ${subFailures.join(", ")}`);
      } else {
        toast.success("Task created");
      }
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
          <DialogTitle>
            {initialSupport
              ? "New support request"
              : kind === "decision" ? "Log a decision"
              : kind === "issue" ? "Log a risk / issue"
              : "New task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Kind selector — drives what this row represents */}
          <div className="space-y-1.5">
            <Label>Log as</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TASK_KINDS.map(k => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                    title={meta.description}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: meta.dotHsl }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {KIND_META[kind].description}
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="new-task-title">
              {kind === "decision" ? "Decision to make" : kind === "issue" ? "Risk summary" : "Title"}
            </Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                kind === "decision" ? "e.g. Use www or apex for the CNAME"
                : kind === "issue" ? "e.g. Client mentioned a possible rebrand"
                : "What needs to get done?"
              }
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
                min={1}
                step={1}
                value={duration}
                onChange={e => handleDurationChange(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Syncs with Start &amp; Due (weekends excluded).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="rounded-md border border-input bg-background px-2 py-1.5 min-h-9">
                <TagPicker
                  value={tags}
                  onChange={setTags}
                  editableNamespaces={["feature", "type"]}
                  placeholder="Tag"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Client & project-type tags are added automatically from the project.</p>
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

          {/* More options */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setMoreOpen(o => !o)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {moreOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              More options
              {!moreOpen && (files.length + links.length + checklist.length + deps.length + watcherIds.length > 0 || estimateHours) ? (
                <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
                  {files.length + links.length} att · {checklist.length} chk · {deps.length} dep · {watcherIds.length} w
                </Badge>
              ) : null}
            </button>

            {moreOpen && (
              <div className="mt-3 space-y-4">
                {/* Attachments + links */}
                <IntakeAttachmentsField
                  files={files}
                  onFilesChange={setFiles}
                  links={links}
                  onLinksChange={setLinks}
                  label="Attachments & links (Figma, GDoc, Sheets, files…)"
                />

                {/* Checklist */}
                <div className="space-y-1.5">
                  <Label>Checklist</Label>
                  <div className="flex gap-2">
                    <Input
                      value={checklistDraft}
                      onChange={e => setChecklistDraft(e.target.value)}
                      placeholder="Add a subtask / acceptance criterion"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = checklistDraft.trim();
                          if (v) { setChecklist([...checklist, v]); setChecklistDraft(""); }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const v = checklistDraft.trim();
                        if (v) { setChecklist([...checklist, v]); setChecklistDraft(""); }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {checklist.length > 0 && (
                    <ul className="space-y-1 mt-1">
                      {checklist.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/40 text-sm">
                          <span className="flex-1 truncate">{c}</span>
                          <Button
                            type="button" size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => setChecklist(checklist.filter((_, idx) => idx !== i))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Blocked by */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Blocked by</Label>
                    <div className="flex items-center gap-2">
                      {deps.length > 0 && (
                        <Select value={revealMode} onValueChange={(v) => setRevealMode(v as RevealMode)}>
                          <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-50 bg-popover">
                            {(["on_complete","on_start","always"] as RevealMode[]).map(m => (
                              <SelectItem key={m} value={m} className="text-xs">{REVEAL_MODE_SHORT[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => setDepPickerOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                  {deps.length > 0 ? (
                    <ul className="space-y-1">
                      {deps.map(d => (
                        <li key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/40">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{d.title}</div>
                            {d.project_title && <div className="text-[11px] text-muted-foreground truncate">{d.project_title}</div>}
                          </div>
                          <Badge className={(STATUS_COLORS as any)[d.status] ?? ""}>{d.status.replace("_", " ")}</Badge>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                            onClick={() => setDeps(deps.filter(x => x.id !== d.id))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">None — this task can start immediately.</p>
                  )}
                </div>

                {/* Watchers */}
                <div className="space-y-1.5">
                  <Label>Watchers <span className="text-xs text-muted-foreground font-normal">(notified but not responsible)</span></Label>
                  <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-background px-2 py-1.5">
                    {watcherIds.length === 0 && <span className="text-xs italic text-muted-foreground">No watchers</span>}
                    {watcherIds.map(uid => {
                      const u = users.find(x => x.id === uid);
                      if (!u) return null;
                      return (
                        <span key={uid} className="inline-flex items-center gap-1 pl-1 pr-1 py-0.5 rounded-full border border-border bg-muted/40 text-xs">
                          <UserAvatar userId={uid} size="xs" />
                          <span className="font-medium max-w-[100px] truncate">{u.name}</span>
                          <button
                            type="button"
                            onClick={() => setWatcherIds(watcherIds.filter(x => x !== uid))}
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
                      onPick={(id) => { if (id && !watcherIds.includes(id)) setWatcherIds([...watcherIds, id]); }}
                      trigger={
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                          <Plus className="h-3 w-3" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Estimated hours */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-task-est">Estimated hours</Label>
                  <Input
                    id="new-task-est"
                    type="number"
                    min={0}
                    step={0.25}
                    value={estimateHours}
                    onChange={e => setEstimateHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="max-w-[160px]"
                  />
                  <p className="text-[11px] text-muted-foreground">Used for workload capacity planning.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <TaskPicker
          open={depPickerOpen}
          onClose={() => setDepPickerOpen(false)}
          excludeIds={deps.map(d => d.id)}
          onPick={async (id) => {
            // Hydrate title/status/project for chip display
            const { data: t } = await supabase.from("pm_tasks").select("id,title,status,project_id").eq("id", id).maybeSingle();
            if (!t) return;
            const { data: p } = await supabase.from("pm_projects").select("title").eq("id", (t as any).project_id).maybeSingle();
            setDeps(prev => [...prev, {
              id: (t as any).id, title: (t as any).title, status: (t as any).status,
              project_title: (p as any)?.title,
            }]);
          }}
        />


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

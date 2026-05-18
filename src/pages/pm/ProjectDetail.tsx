import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowLeft, Calendar as CalIcon, Pin, PinOff, Send, Rocket } from "lucide-react";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { ConvertToProjectModal } from "@/components/pm/ConvertToProjectModal";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProject, fetchTasks, fetchPhases, fetchDependencies,
  updateProject, updateTask, createTask, logActivity,
} from "@/lib/pm/api";
import { useTasksChanged, useTaskDateProposed } from "@/lib/pm/refresh";
import type { PmProject, PmTask, PmPhase, PmDependency } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { StatusPill } from "@/components/pm/StatusPill";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { GanttChart } from "@/components/pm/GanttChart";
import { CascadeConfirmModal } from "@/components/pm/CascadeConfirmModal";
import { recalculateBackwardFromGoLive, recalculateForward, type DateDiff } from "@/lib/pm/scheduler";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { useMeMode } from "@/hooks/useMeMode";
import { useViewMode } from "@/hooks/useViewMode";
import { ViewToggle } from "@/components/pm/ViewToggle";
import { TaskKanban } from "@/components/pm/TaskKanban";
import { ConfigureTimelinePanel } from "@/components/pm/ConfigureTimelinePanel";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/pm/project/RichTextEditor";
import { TeamCard } from "@/components/pm/project/TeamCard";
import { ClientCard } from "@/components/pm/project/ClientCard";
import { FilesTab } from "@/components/pm/project/FilesTab";
import { MentionTextarea, MentionText } from "@/components/pm/drawer/MentionTextarea";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const [project, setProject] = useState<PmProject | null>(null);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [deps, setDeps] = useState<PmDependency[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "comments" | "activity">("all");
  const allUsers = useMockUsers();
  const drawer = useTaskDrawerLink();

  const [pendingDiffs, setPendingDiffs] = useState<DateDiff[]>([]);
  const [pendingGoLive, setPendingGoLive] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"forward" | "backward">("backward");
  const [configOpen, setConfigOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const reload = async () => {
    if (!id) return;
    const [p, t, ph, d] = await Promise.all([fetchProject(id), fetchTasks(id), fetchPhases(id), fetchDependencies(id)]);
    setProject(p); setTasks(t); setPhases(ph); setDeps(d);
    const { data: act } = await supabase.from("pm_activity_log").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50);
    setActivity(act || []);
    const { data: cm } = await supabase.from("pm_comments").select("*").eq("project_id", id).order("created_at", { ascending: false });
    setComments(cm || []);
  };
  useEffect(() => { reload(); }, [id]);
  useTasksChanged(reload);

  useTaskDateProposed(({ taskId, start, end }) => {
    if (!tasks.find(t => t.id === taskId)) return;
    const diffs = recalculateForward(taskId, { start, end }, tasks, deps);
    if (!diffs.length) return;
    setPendingMode("forward");
    setPendingGoLive(null);
    setPendingDiffs(diffs);
  });

  const tasksByPhase = useMemo(() => {
    const m = new Map<string | null, PmTask[]>();
    for (const t of tasks) {
      const k = t.phase_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tasks]);

  const done = tasks.filter(t => t.status === "complete" || t.status === "approved").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const blockers = tasks.filter(t => t.status === "blocked");

  async function handleGoLiveChange(newDate: string) {
    if (!project) return;
    if (!tasks.length) {
      await updateProject(project.id, { go_live_date: newDate });
      reload(); return;
    }
    const diffs = recalculateBackwardFromGoLive(newDate, tasks, deps);
    setPendingMode("backward");
    setPendingDiffs(diffs);
    setPendingGoLive(newDate);
  }

  async function applyCascade() {
    if (!project) return;
    if (pendingMode === "backward" && pendingGoLive) {
      await updateProject(project.id, { go_live_date: pendingGoLive });
      await logActivity({ project_id: project.id, user_id: user?.id, action: "project.go_live_changed", payload: { go_live: pendingGoLive, shifted: pendingDiffs.length } });
    } else {
      await logActivity({ project_id: project.id, user_id: user?.id, action: "task.dates_cascaded", payload: { shifted: pendingDiffs.length } });
    }
    for (const d of pendingDiffs) {
      await updateTask(d.taskId, { start_date: d.newStart, due_date: d.newEnd });
    }
    toast.success(`${pendingDiffs.length} task${pendingDiffs.length === 1 ? "" : "s"} updated`);
    setPendingDiffs([]); setPendingGoLive(null);
    reload();
  }

  async function addTask(phaseId: string | null, title: string) {
    if (!project || !title.trim()) return;
    await createTask({
      project_id: project.id, phase_id: phaseId,
      title, type: "design", status: "unclaimed", priority: "medium",
      duration_days: 1, sort_order: tasks.length, created_by: user?.id ?? null,
    });
    reload();
  }

  async function postComment() {
    if (!project || !newComment.trim()) return;
    const body = newComment.trim();
    await supabase.from("pm_comments").insert({
      project_id: project.id, user_id: user?.id ?? null, body,
      mentions: commentMentions, pinned: false,
    } as any);
    if (commentMentions.length && user) {
      const rows = commentMentions.filter(id => id !== user.id).map(uid => ({
        user_id: uid, type: "mention",
        title: `${user.name} mentioned you in ${project.title}`,
        body: body.slice(0, 200),
        link: `/pm/projects/${project.id}?tab=activity`,
        read: false,
      }));
      if (rows.length) await supabase.from("pm_notifications").insert(rows as any);
    }
    await logActivity({ project_id: project.id, user_id: user?.id, action: "comment.added" });
    setNewComment(""); setCommentMentions([]);
    reload();
  }

  async function togglePin(c: any) {
    if (user?.role !== "pm") return;
    if (!c.pinned) {
      const pinnedCount = comments.filter(x => x.pinned).length;
      if (pinnedCount >= 3) { toast.error("Max 3 pinned comments"); return; }
    }
    await supabase.from("pm_comments").update({ pinned: !c.pinned } as any).eq("id", c.id);
    reload();
  }

  if (!project) return <div className="p-6">Loading…</div>;
  const p: any = project;
  const isRequest = (p.work_type ?? "project") === "request";

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <UnclaimedBanner projectId={project.id} />
      <Link to="/pm/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Projects
      </Link>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <WorkTypeBadge workType={p.work_type ?? "project"} />
                <h1 className="text-2xl font-bold font-unbounded">{project.title}</h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{project.type}</Badge>
                <Badge variant="outline">{project.status}</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3">
              {isRequest ? (
                <Button size="sm" onClick={() => setConvertOpen(true)}>
                  <Rocket className="h-4 w-4 mr-1" /> Convert to Project
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                    <Settings2 className="h-4 w-4 mr-1" /> Configure Timeline
                  </Button>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Go-Live</div>
                    <DatePicker value={project.go_live_date} onChange={v => handleGoLiveChange(v ?? "")} className="w-44" />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{done}/{tasks.length} · {pct}%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {!isRequest && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card><CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Brief</div>
            <RichTextEditor
              value={project.description ?? ""}
              onChange={(html) => setProject({ ...project, description: html })}
              onBlur={() => updateProject(project.id, { description: project.description ?? "" })}
              placeholder="Project brief…"
            />
          </CardContent></Card>
          <div className={`grid grid-cols-1 ${isRequest ? "md:grid-cols-2" : "md:grid-cols-3"} gap-3`}>
            {!isRequest && (
              <Card><CardContent className="p-4 space-y-2">
                <div className="text-xs uppercase text-muted-foreground mb-1">Key Dates</div>
                <div className="text-sm flex items-center justify-between gap-2">
                  <span>Kickoff</span>
                  <DatePicker value={p.kickoff_date ?? null} onChange={v => updateProject(project.id, { kickoff_date: v ?? null } as any).then(reload)} className="w-36 h-8" />
                </div>
                <div className="text-sm flex items-center justify-between gap-2">
                  <span>Start</span>
                  <DatePicker value={project.start_date} onChange={v => updateProject(project.id, { start_date: v ?? null }).then(reload)} className="w-36 h-8" />
                </div>
                <div className="text-sm flex items-center justify-between gap-2">
                  <span>Go-Live</span>
                  <span className="text-muted-foreground">{fmtDate(project.go_live_date)}</span>
                </div>
              </CardContent></Card>
            )}
            <TeamCard projectId={project.id} />
            <ClientCard project={p} onChange={reload} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card><CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Stats</div>
              <div className="text-sm flex justify-between"><span>Total tasks</span><span>{tasks.length}</span></div>
              <div className="text-sm flex justify-between"><span>Complete</span><span>{done}</span></div>
              <div className="text-sm flex justify-between"><span>Blocked</span><span className="text-red-600">{blockers.length}</span></div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Recent Activity</div>
              <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                {activity.slice(0, 6).map(a => (
                  <li key={a.id}>· {a.action} <span className="text-muted-foreground">({fmtDate(a.created_at?.slice(0,10))})</span></li>
                ))}
                {!activity.length && <li className="text-muted-foreground italic">None yet</li>}
              </ul>
            </CardContent></Card>
          </div>
          {blockers.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5"><CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Open Blockers</div>
              {blockers.map(b => (
                <div key={b.id} className="text-sm py-1 cursor-pointer hover:underline" onClick={() => drawer.open(b.id)}>· {b.title} {b.dev_blocker && <span className="text-muted-foreground italic">— {b.dev_blocker}</span>}</div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <TaskTabContent
            phases={phases}
            tasksByPhase={tasksByPhase}
            onOpen={drawer.open}
            onAdd={addTask}
            userRole={user?.role}
            meId={user?.id ?? null}
            projectId={project.id}
            flat={isRequest}
          />
        </TabsContent>

        {!isRequest && (
          <TabsContent value="timeline">
            <GanttChart tasks={tasks} deps={deps} onTaskClick={drawer.open}
              onProposeReschedule={(diffs) => { setPendingDiffs(diffs); setPendingGoLive(project.go_live_date); }} />
            <p className="text-xs text-muted-foreground mt-2">Drag a bar to propose a reschedule. Bold outline = critical path. Dashed line = today.</p>
          </TabsContent>
        )}

        <TabsContent value="files">
          <FilesTab projectId={project.id} tasks={tasks} onOpenTask={drawer.open} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          <Card><CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Add comment</div>
            <MentionTextarea
              value={newComment}
              onChange={setNewComment}
              onSubmit={postComment}
              onMentionsChange={setCommentMentions}
              users={allUsers}
              placeholder="Write a comment… use @ to mention someone"
            />
            <div className="flex justify-between items-center">
              <div className="text-[11px] text-muted-foreground">
                {commentMentions.length > 0 && `Mentions: ${commentMentions.length} · `}
                Enter to send · Shift+Enter for newline
              </div>
              <Button size="sm" onClick={postComment} disabled={!newComment.trim()}>
                <Send className="h-3 w-3 mr-1" /> Post
              </Button>
            </div>
          </CardContent></Card>

          <div className="flex gap-1">
            {(["all", "comments", "activity"] as const).map(f => (
              <button key={f} type="button" onClick={() => setActivityFilter(f)}
                className={`h-7 px-3 rounded-full text-xs border transition-colors ${activityFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}>
                {f === "all" ? "All" : f === "comments" ? "Comments only" : "Activity only"}
              </button>
            ))}
          </div>

          <Card><CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Feed</div>
            {(() => {
              const isPM = user?.role === "pm";
              const cItems = activityFilter !== "activity" ? comments.map(c => ({ ...c, _kind: "comment" as const })) : [];
              const aItems = activityFilter !== "comments" ? activity.map(a => ({ ...a, _kind: "activity" as const })) : [];
              const all = [...cItems, ...aItems];
              const pinned = all.filter(x => x._kind === "comment" && x.pinned)
                .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
              const rest = all.filter(x => !(x._kind === "comment" && x.pinned))
                .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
              const ordered = [...pinned, ...rest].slice(0, 100);
              if (!ordered.length) return <div className="text-xs text-muted-foreground italic">Nothing to show.</div>;
              return ordered.map(item => {
                if (item._kind === "comment") {
                  const u = allUsers.find(x => x.id === item.user_id);
                  return (
                    <div key={item.id} className="text-sm border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <UserAvatar userId={item.user_id} size="sm" />
                        <span className="text-sm font-medium">{u?.name ?? "Unknown"}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                        {item.pinned && <Badge variant="secondary" className="text-[10px]">📌 Pinned</Badge>}
                        {isPM && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => togglePin(item)} title={item.pinned ? "Unpin" : "Pin"}>
                            {item.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap pl-8"><MentionText text={item.body} /></div>
                    </div>
                  );
                }
                return (
                  <div key={item.id} className="text-xs text-muted-foreground border-b border-border/50 pb-2">
                    · {item.action} ({fmtDate(item.created_at?.slice(0, 10))})
                  </div>
                );
              });
            })()}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Linked forms appear here. Create a form in <Link to="/pm/forms" className="underline">Forms</Link> and route its submissions to this project.
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Webhooks and client environment data are managed in <Link to="/pm/integrations" className="underline">Integrations</Link>.
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <TaskDrawer />
      <CascadeConfirmModal
        open={pendingDiffs.length > 0 || !!pendingGoLive}
        onOpenChange={(v) => { if (!v) { setPendingDiffs([]); setPendingGoLive(null); reload(); } }}
        diffs={pendingDiffs}
        goLiveDate={pendingMode === "backward" ? pendingGoLive : project.go_live_date}
        onConfirm={applyCascade}
      />
      <ConfigureTimelinePanel project={project} open={configOpen} onOpenChange={setConfigOpen} onApplied={reload} />
      <ConvertToProjectModal open={convertOpen} onOpenChange={setConvertOpen} projectId={project.id} userId={user?.id ?? null} onConverted={reload} />
    </div>
  );
}

type TaskPill = "all" | "pm" | "design" | "dev" | "review";

const PILL_LABEL: Record<TaskPill, string> = {
  all: "All", pm: "PM", design: "Design", dev: "Dev", review: "Review",
};
const PILL_TYPES: Record<Exclude<TaskPill, "all" | "review">, string[]> = {
  pm: ["review", "approval"],
  design: ["design", "content"],
  dev: ["dev", "qa"],
};

function defaultPillForRole(role?: string | null): TaskPill {
  if (role === "designer") return "design";
  if (role === "developer") return "dev";
  return "all";
}
function dimsForRole(role?: string | null): Set<string> | null {
  if (role === "designer") return new Set(["dev", "qa"]);
  if (role === "developer") return new Set(["design", "content"]);
  return null;
}

function TaskTabContent({
  phases, tasksByPhase, onOpen, onAdd, userRole, meId, projectId,
}: {
  phases: PmPhase[];
  tasksByPhase: Map<string | null, PmTask[]>;
  onOpen: (id: string) => void;
  onAdd: (phaseId: string | null, title: string) => void;
  userRole?: string | null;
  meId: string | null;
  projectId: string;
}) {
  const lsKey = `pm.projectTasksPill.${projectId}.${meId ?? "anon"}`;
  const [pill, setPillState] = useState<TaskPill>(() => {
    if (typeof window === "undefined") return defaultPillForRole(userRole);
    const v = window.localStorage.getItem(lsKey);
    return (v as TaskPill) || defaultPillForRole(userRole);
  });
  const setPill = (p: TaskPill) => {
    setPillState(p);
    try { window.localStorage.setItem(lsKey, p); } catch {}
  };
  // Re-seed when key (project/user) changes and nothing stored yet.
  useEffect(() => {
    const v = window.localStorage.getItem(lsKey);
    setPillState((v as TaskPill) || defaultPillForRole(userRole));
  }, [lsKey, userRole]);
  const { isMe, setMode: setMeMode } = useMeMode();
  const [view, setView] = useViewMode("project.tasks", "list");

  const dimSet = pill === "all" && view === "list" ? dimsForRole(userRole) : null;

  const filterPhaseTasks = (list: PmTask[]) => {
    let out = list;
    if (pill === "review") out = out.filter(t => t.status === "in_review");
    else if (pill !== "all") out = out.filter(t => PILL_TYPES[pill].includes(t.type));
    if (isMe && meId) out = out.filter(t => t.assignee_id === meId);
    return out;
  };

  const pills: TaskPill[] = ["all", "pm", "design", "dev", "review"];
  const filtersActive = isMe || pill !== defaultPillForRole(userRole);

  // Build list of phase entries (including null). Hide empty ones when a filter is active.
  const phaseEntries: { phase: PmPhase | null; tasks: PmTask[] }[] = [];
  for (const ph of phases) {
    const t = filterPhaseTasks(tasksByPhase.get(ph.id) || []);
    if (t.length > 0 || !filtersActive) phaseEntries.push({ phase: ph, tasks: t });
  }
  if (tasksByPhase.has(null)) {
    const t = filterPhaseTasks(tasksByPhase.get(null)!);
    if (t.length > 0 || !filtersActive) phaseEntries.push({ phase: null, tasks: t });
  }

  // Flat task list for kanban view.
  const allFiltered = phaseEntries.flatMap(e => e.tasks);
  const totalVisible = allFiltered.length;

  function clearFilters() {
    setPill(defaultPillForRole(userRole));
    if (isMe) setMeMode("all");
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">View</span>
        {pills.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPill(p)}
            className={`px-3 h-7 text-xs font-medium rounded-full border transition ${
              pill === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {PILL_LABEL[p]}
          </button>
        ))}
        {isMe && (
          <span className="ml-2 text-xs text-muted-foreground italic">Showing my tasks</span>
        )}
        <div className="ml-auto">
          <ViewToggle value={view} onChange={(m) => setView(m as any)} modes={["list", "kanban"]} />
        </div>
      </div>

      {totalVisible === 0 && filtersActive && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No tasks match the current filters.
            <button type="button" onClick={clearFilters} className="ml-2 underline hover:text-foreground">
              Clear filters
            </button>
          </CardContent>
        </Card>
      )}

      {totalVisible > 0 && view === "kanban" && (
        <TaskKanban tasks={allFiltered} onOpen={onOpen} />
      )}

      {view === "list" && phaseEntries.map(({ phase, tasks }) => (
        <PhaseGroup
          key={phase?.id ?? "no-phase"}
          phase={phase}
          tasks={tasks}
          onOpen={onOpen}
          onAdd={(title) => onAdd(phase?.id ?? null, title)}
          dimSet={dimSet}
          allowAdd={!filtersActive}
        />
      ))}
    </>
  );
}

function PhaseGroup({ phase, tasks, onOpen, onAdd, dimSet, allowAdd = true }: {
  phase: PmPhase | null; tasks: PmTask[]; onOpen: (id: string) => void;
  onAdd: (title: string) => void; dimSet?: Set<string> | null; allowAdd?: boolean;
}) {
  const [adding, setAdding] = useState("");
  return (
    <Card>
      <CardContent className="p-4">
        <div className="font-semibold text-sm mb-2">{phase?.name ?? "No phase"}</div>
        <div className="space-y-1">
          {tasks.map(t => {
            const dim = dimSet?.has(t.type);
            return (
              <div
                key={t.id}
                className={`grid grid-cols-12 items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 cursor-pointer ${dim ? "opacity-50" : ""}`}
                onClick={() => onOpen(t.id)}
              >
                <div className="col-span-5 text-sm font-medium truncate">{t.title}</div>
                <div className="col-span-2"><Badge variant="outline" className="text-[10px]">{t.type}</Badge></div>
                <div className="col-span-2"><StatusPill status={t.status} /></div>
                <div className="col-span-2 text-xs text-muted-foreground"><CalIcon className="h-3 w-3 inline mr-1" />{fmtDate(t.due_date)}</div>
                <div className="col-span-1 flex justify-end"><UserAvatar userId={t.assignee_id} size="xs" /></div>
              </div>
            );
          })}
          {allowAdd && (
            <div className="flex gap-2 pt-2">
              <Input value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add task…" className="text-sm h-8"
                onKeyDown={(e) => { if (e.key === "Enter") { onAdd(adding); setAdding(""); } }} />
              <Button size="sm" variant="ghost" onClick={() => { onAdd(adding); setAdding(""); }} disabled={!adding.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

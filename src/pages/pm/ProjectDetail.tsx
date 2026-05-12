import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowLeft, Calendar as CalIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProject, fetchTasks, fetchPhases, fetchDependencies,
  updateProject, updateTask, createTask, logActivity,
} from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject, PmTask, PmPhase, PmDependency } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { StatusPill } from "@/components/pm/StatusPill";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { GanttChart } from "@/components/pm/GanttChart";
import { CascadeConfirmModal } from "@/components/pm/CascadeConfirmModal";
import { recalculateBackwardFromGoLive, type DateDiff } from "@/lib/pm/scheduler";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";

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
  const drawer = useTaskDrawerLink();

  const [pendingDiffs, setPendingDiffs] = useState<DateDiff[]>([]);
  const [pendingGoLive, setPendingGoLive] = useState<string | null>(null);

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
    setPendingDiffs(diffs);
    setPendingGoLive(newDate);
  }

  async function applyCascade() {
    if (!project || !pendingGoLive) return;
    await updateProject(project.id, { go_live_date: pendingGoLive });
    for (const d of pendingDiffs) {
      await updateTask(d.taskId, { start_date: d.newStart, due_date: d.newEnd });
    }
    await logActivity({ project_id: project.id, user_id: user?.id, action: "project.go_live_changed", payload: { go_live: pendingGoLive, shifted: pendingDiffs.length } });
    toast.success(`Updated go-live · ${pendingDiffs.length} tasks shifted`);
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
    await supabase.from("pm_comments").insert({ project_id: project.id, user_id: user?.id ?? null, body: newComment } as any);
    await logActivity({ project_id: project.id, user_id: user?.id, action: "comment.added" });
    setNewComment("");
    reload();
  }

  if (!project) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <Link to="/pm/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Projects
      </Link>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold font-unbounded">{project.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{project.type}</Badge>
                <Badge variant="outline">{project.status}</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Go-Live</div>
              <DatePicker value={project.go_live_date} onChange={v => handleGoLiveChange(v ?? "")} className="w-44" />
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
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card><CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Brief</div>
            <Textarea rows={4} value={project.description ?? ""} onChange={e => setProject({ ...project, description: e.target.value })}
              onBlur={e => updateProject(project.id, { description: e.target.value })} />
          </CardContent></Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Key Dates</div>
              <div className="text-sm flex justify-between"><span>Start</span><span>{fmtDate(project.start_date)}</span></div>
              <div className="text-sm flex justify-between"><span>Go-Live</span><span>{fmtDate(project.go_live_date)}</span></div>
            </CardContent></Card>
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
          {phases.map(ph => (
            <PhaseGroup key={ph.id} phase={ph} tasks={tasksByPhase.get(ph.id) || []} onOpen={drawer.open} onAdd={(title) => addTask(ph.id, title)} />
          ))}
          {tasksByPhase.has(null) && (
            <PhaseGroup phase={null} tasks={tasksByPhase.get(null)!} onOpen={drawer.open} onAdd={(title) => addTask(null, title)} />
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <GanttChart tasks={tasks} deps={deps} onTaskClick={drawer.open}
            onProposeReschedule={(diffs) => { setPendingDiffs(diffs); setPendingGoLive(project.go_live_date); }} />
          <p className="text-xs text-muted-foreground mt-2">Drag a bar to propose a reschedule. Bold outline = critical path. Dashed line = today.</p>
        </TabsContent>

        <TabsContent value="files">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Attachments live on individual tasks. Open a task to upload or link assets.
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="text-xs uppercase text-muted-foreground">Add comment</div>
            <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Use @name to mention a teammate" />
            <Button onClick={postComment} disabled={!newComment.trim()}>Post</Button>
          </CardContent></Card>
          <Card><CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Feed</div>
            {[...comments.map(c => ({ ...c, _kind: "comment" })), ...activity.map(a => ({ ...a, _kind: "activity" }))]
              .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
              .slice(0, 50)
              .map(item => (
                <div key={item.id} className="text-sm border-b border-border/50 pb-2">
                  {item._kind === "comment"
                    ? <><div>{item.body}</div><div className="text-xs text-muted-foreground">{fmtDate(item.created_at?.slice(0,10))}</div></>
                    : <div className="text-xs text-muted-foreground">· {item.action} ({fmtDate(item.created_at?.slice(0,10))})</div>}
                </div>
              ))}
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
        onOpenChange={(v) => { if (!v) { setPendingDiffs([]); setPendingGoLive(null); } }}
        diffs={pendingDiffs}
        goLiveDate={pendingGoLive ?? project.go_live_date}
        onConfirm={applyCascade}
      />
    </div>
  );
}

function PhaseGroup({ phase, tasks, onOpen, onAdd }: { phase: PmPhase | null; tasks: PmTask[]; onOpen: (id: string) => void; onAdd: (title: string) => void }) {
  const [adding, setAdding] = useState("");
  return (
    <Card>
      <CardContent className="p-4">
        <div className="font-semibold text-sm mb-2">{phase?.name ?? "No phase"}</div>
        <div className="space-y-1">
          {tasks.map(t => (
            <div key={t.id} className="grid grid-cols-12 items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 cursor-pointer" onClick={() => onOpen(t.id)}>
              <div className="col-span-5 text-sm font-medium truncate">{t.title}</div>
              <div className="col-span-2"><Badge variant="outline" className="text-[10px]">{t.type}</Badge></div>
              <div className="col-span-2"><StatusPill status={t.status} /></div>
              <div className="col-span-2 text-xs text-muted-foreground"><CalIcon className="h-3 w-3 inline mr-1" />{fmtDate(t.due_date)}</div>
              <div className="col-span-1 flex justify-end"><UserAvatar userId={t.assignee_id} size="xs" /></div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add task…" className="text-sm h-8"
              onKeyDown={(e) => { if (e.key === "Enter") { onAdd(adding); setAdding(""); } }} />
            <Button size="sm" variant="ghost" onClick={() => { onAdd(adding); setAdding(""); }} disabled={!adding.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

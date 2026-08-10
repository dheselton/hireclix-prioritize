import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PortalMessageThread } from "@/components/pm/portal/PortalMessageThread";
import { AlertTriangle, CircleDot, ListTodo, MessageSquare, FileText, ExternalLink, Paperclip, FolderKanban } from "lucide-react";
import { StatusPill } from "@/components/pm/StatusPill";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { ProjectTabs, type ProjectTabId } from "@/components/pm/project/ProjectTabs";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { fmtDate } from "@/lib/pm/format";
import { buildQueueLink } from "@/lib/pm/links";
import {
  useMyTasks, useMyRequests, useMyMessageThreads, useMyProjects, requestRef,
  fetchRequestTimeline, fetchRequestFiles, markThreadRead,
  type MyRequest, type RequestTimelineEntry, type RequestFile, type MyProject,
} from "@/lib/pm/myPortal";
import type { PmTask } from "@/types/pm";

type TabId = "tasks" | "projects" | "requests" | "messages";
const TABS = [
  { id: "tasks", label: "My Tasks" },
  { id: "projects", label: "My Projects" },
  { id: "requests", label: "My Requests" },
  { id: "messages", label: "Messages" },
] as const;

const RELATION_LABEL: Record<string, string> = {
  member: "Team", assignee: "Assigned", requester: "Requester", watcher: "Watching",
};

/* ------------------------------------------------------------ project list */

function MyProjectCard({ project }: { project: MyProject }) {
  const pct = project.totalTasks ? Math.round((project.doneTasks / project.totalTasks) * 100) : 0;
  const roleChip = project.roleLabel
    ? project.roleLabel.replace(/_/g, " ")
    : RELATION_LABEL[project.relations[0]] ?? "Team";

  return (
    <div className="rounded-md border border-border/60 bg-card p-3 space-y-2 hover:bg-accent/20 transition">
      <div className="flex items-start gap-3">
        <Link to={`/pm/projects/${project.id}`} className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate hover:underline">{project.title}</span>
          <span className="block text-[11px] text-muted-foreground truncate">
            {project.clientName ?? "No client"}
            {project.goLiveDate ? ` · Go-live ${fmtDate(project.goLiveDate)}` : ""}
          </span>
        </Link>
        <Badge variant="outline" className="text-[10px] capitalize shrink-0">
          {project.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {project.doneTasks}/{project.totalTasks} done
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px] capitalize">{roleChip}</Badge>
        {project.relations.filter(r => r !== "member").map(r => (
          <Badge key={r} variant="outline" className="text-[10px]">{RELATION_LABEL[r]}</Badge>
        ))}
        <span className="flex-1" />
        {project.myOverdueTasks > 0 && (
          <Link
            to={buildQueueLink({ base: `/pm/projects/${project.id}`, chips: ["assigned_to_me", "overdue"] })}
            className="text-[11px] font-medium text-destructive hover:underline"
          >
            {project.myOverdueTasks} overdue
          </Link>
        )}
        <Link
          to={buildQueueLink({ base: `/pm/projects/${project.id}`, chips: ["assigned_to_me"] })}
          className="text-[11px] text-info hover:underline"
        >
          {project.myOpenTasks} of my tasks
        </Link>
      </div>
    </div>
  );
}


/* --------------------------------------------------------------- task list */

function TaskRow({ task, projectTitle }: { task: PmTask; projectTitle?: string }) {
  return (
    <Link
      to={`/pm/tasks/${task.id}`}
      className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/60 bg-card hover:bg-accent/30 transition"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{task.title}</span>
        <span className="block text-[11px] text-muted-foreground truncate">
          {projectTitle ?? "—"}{task.due_date ? ` · Due ${fmtDate(task.due_date)}` : ""}
        </span>
      </span>
      <StatusPill status={task.status} />
      <UserAvatar userId={task.assignee_id} size="xs" />
    </Link>
  );
}

function TaskGroup({
  title, icon, tasks, projects, link, emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: PmTask[];
  projects: Map<string, { title: string }>;
  link: string;
  emptyHint: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        {tasks.length > 0 ? (
          <Link to={link} className="text-xs text-info hover:underline">{tasks.length}</Link>
        ) : (
          <span className="text-xs text-muted-foreground/60">0</span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">{emptyHint}</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(t => (
            <TaskRow key={t.id} task={t} projectTitle={projects.get(t.project_id)?.title} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ request pane */

function RequestDetail({ request, onClose }: { request: MyRequest | null; onClose: () => void }) {
  const [timeline, setTimeline] = useState<RequestTimelineEntry[]>([]);
  const [files, setFiles] = useState<RequestFile[]>([]);

  useEffect(() => {
    if (!request) { setTimeline([]); setFiles([]); return; }
    let cancelled = false;
    Promise.all([fetchRequestTimeline(request), fetchRequestFiles(request)]).then(([t, f]) => {
      if (cancelled) return;
      setTimeline(t); setFiles(f);
    });
    return () => { cancelled = true; };
  }, [request]);

  const detailFields = useMemo(() => {
    if (!request) return [] as Array<[string, string]>;
    return Object.entries(request.payload)
      .filter(([k, v]) => v != null && v !== "" && !["title", "request_type"].includes(k))
      .map(([k, v]) => [k.replace(/_/g, " "), Array.isArray(v) ? v.join(", ") : String(v)] as [string, string]);
  }, [request]);

  return (
    <Sheet open={!!request} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {request && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{request.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{requestRef(request)}</Badge>
                {request.requestType && <Badge variant="secondary">{request.requestType.replace(/_/g, " ")}</Badge>}
                <span className="text-muted-foreground">Submitted {fmtDate(request.createdAt)}</span>
                {request.projectId && (
                  <Link to={`/pm/projects/${request.projectId}`} className="inline-flex items-center gap-1 text-info hover:underline">
                    Open project <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {detailFields.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Details</h3>
                  <dl className="space-y-2">
                    {detailFields.map(([k, v]) => (
                      <div key={k} className="text-sm">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                        <dd className="whitespace-pre-wrap break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Status history</h3>
                {timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
                ) : (
                  <ol className="space-y-2 border-l border-border pl-3">
                    {timeline.map(e => (
                      <li key={e.id} className="text-xs">
                        <span className="font-medium">{e.action.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground"> · {fmtDate(e.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Files</h3>
                {files.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No files attached.</p>
                ) : (
                  <ul className="space-y-1">
                    {files.map(f => (
                      <li key={f.id}>
                        <a href={f.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-info hover:underline">
                          <Paperclip className="h-3 w-3" /> {f.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------- page */

export default function MyPortal() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabId = raw === "requests" || raw === "messages" ? raw : "tasks";
  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  const myTasks = useMyTasks(userId);
  const { requests, loading: reqLoading } = useMyRequests(userId, user?.email ?? null);
  const { threads, loading: msgLoading } = useMyMessageThreads(userId);
  const [openRequest, setOpenRequest] = useState<MyRequest | null>(null);
  const [openThread, setOpenThread] = useState<{ projectId: string; title: string } | null>(null);

  const projectTitles = useMemo(
    () => new Map([...myTasks.projects].map(([id, p]) => [id, { title: p.title }])),
    [myTasks.projects],
  );
  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Work</h1>
        <p className="text-sm text-muted-foreground">
          Everything assigned to you, everything you've requested, and your project conversations.
        </p>
      </div>

      <ProjectTabs
        value={tab as unknown as ProjectTabId}
        onChange={(v) => setTab(v as unknown as TabId)}
        tabs={TABS.map(t => ({
          id: t.id as unknown as ProjectTabId,
          label: t.label,
          badge: t.id === "messages" && unreadTotal > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {unreadTotal}
            </span>
          ) : undefined,
        }))}
      />

      {tab === "tasks" && (
        <div className="space-y-6">
          {myTasks.loading ? (
            <p className="text-sm text-muted-foreground">Loading your tasks…</p>
          ) : (
            <>
              <TaskGroup
                title="Needs attention" icon={<AlertTriangle className="h-4 w-4" />}
                tasks={myTasks.attention} projects={projectTitles}
                link={buildQueueLink({ chips: ["overdue"] })}
                emptyHint="Nothing blocked or overdue. Nice."
              />
              <TaskGroup
                title="In progress" icon={<CircleDot className="h-4 w-4" />}
                tasks={myTasks.inProgress} projects={projectTitles}
                link={buildQueueLink({ chips: ["assigned_to_me"] })}
                emptyHint="Nothing started yet."
              />
              <TaskGroup
                title="Up next" icon={<ListTodo className="h-4 w-4" />}
                tasks={myTasks.upNext} projects={projectTitles}
                link={buildQueueLink({ chips: ["assigned_to_me"] })}
                emptyHint="Your queue is clear."
              />
              {myTasks.recentlyCompleted.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Recently completed</h2>
                  <div className="space-y-1.5 opacity-70">
                    {myTasks.recentlyCompleted.map(t => (
                      <TaskRow key={t.id} task={t} projectTitle={projectTitles.get(t.project_id)?.title} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === "requests" && (
        <Card>
          <CardContent className="p-3 space-y-1.5">
            {reqLoading ? (
              <p className="text-sm text-muted-foreground p-2">Loading your requests…</p>
            ) : requests.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">You haven't submitted any requests yet.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/f/quick-request">Submit a request</Link>
                </Button>
              </div>
            ) : requests.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/60">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{r.title}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {requestRef(r)}{r.requestType ? ` · ${r.requestType.replace(/_/g, " ")}` : ""} · {fmtDate(r.createdAt)}
                  </span>
                </span>
                <Badge variant="outline" className="text-[10px] capitalize">{r.status.replace(/_/g, " ")}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setOpenRequest(r)}>View</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "messages" && (
        <Card>
          <CardContent className="p-3 space-y-1.5">
            {msgLoading ? (
              <p className="text-sm text-muted-foreground p-2">Loading conversations…</p>
            ) : threads.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">No project conversations yet.</p>
              </div>
            ) : threads.map(t => (
              <button
                key={t.projectId}
                type="button"
                onClick={() => {
                  if (userId) markThreadRead(userId, t.projectId);
                  setOpenThread({ projectId: t.projectId, title: t.projectTitle });
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border border-border/60 hover:bg-accent/30 transition"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {t.projectTitle}
                    {t.clientName && <span className="text-muted-foreground font-normal"> · {t.clientName}</span>}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {t.lastAuthor ? `${t.lastAuthor}: ` : ""}{t.lastBody}
                  </span>
                </span>
                {t.unread > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {t.unread}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(t.lastAt)}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <RequestDetail request={openRequest} onClose={() => setOpenRequest(null)} />

      <Sheet open={!!openThread} onOpenChange={(o) => { if (!o) setOpenThread(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {openThread && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6">{openThread.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <PortalMessageThread
                  projectId={openThread.projectId}
                  authorName={user?.name ?? "Team"}
                  authorUserId={userId}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

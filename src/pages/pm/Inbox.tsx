import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Inbox as InboxIcon, Rocket, Ban, RotateCcw, ExternalLink, Search, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjects, fetchTasks, updateTask } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { AssigneePopover } from "@/components/pm/AssigneePopover";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { ConvertToProjectModal } from "@/components/pm/ConvertToProjectModal";
import { fmtDate } from "@/lib/pm/format";
import { declineTask, restoreTask, isDeclined, declineInfo, snippet } from "@/lib/pm/inbox";
import { TYPE_LABEL } from "@/hooks/useTypeFilter";
import { PRIORITIES, TASK_STATUSES, type PmProject, type PmTask, type TaskPriority, type TaskStatus, type TaskType } from "@/types/pm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


type TabId = "all" | "quick" | "projects" | "declined";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "quick", label: "Quick requests" },
  { id: "projects", label: "SOW + Projects" },
  { id: "declined", label: "Declined" },
];

interface Row {
  task: PmTask;
  project: PmProject | undefined;
  clientName: string | null;
  requesterName: string | null;
}

type ClientGroup = {
  clientId: string;
  clientName: string;
  projects: Map<string, ProjectGroup>;
};

type ProjectGroup = {
  projectId: string;
  project: PmProject | undefined;
  tasks: Row[];
};

export default function Inbox() {
  const { user } = useCurrentUser();
  const users = useMockUsers();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [declineTarget, setDeclineTarget] = useState<PmTask[] | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [convertProjectId, setConvertProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<TaskType>>(new Set());


  const reload = async () => {
    const [t, p, c] = await Promise.all([
      fetchTasks(),
      fetchProjects(),
      supabase.from("clients").select("id,name"),
    ]);
    setTasks(t);
    setProjects(p);
    setClients(new Map(((c.data as any[]) || []).map(x => [x.id, x.name])));
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  useTasksChanged(reload);

  const userNames = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);

  const rows = useMemo<Row[]>(() => {
    const projMap = new Map(projects.map(p => [p.id, p]));
    return tasks
      .filter(t => t.status === "unclaimed")
      .map(t => {
        const project = projMap.get(t.project_id);
        return {
          task: t,
          project,
          clientName: project?.client_id ? clients.get(project.client_id) ?? null : null,
          requesterName: (project as any)?.requested_by
            ? userNames.get((project as any).requested_by) ?? null
            : null,
        };
      })
      .sort((a, b) => (a.task.created_at || "").localeCompare(b.task.created_at || ""));
  }, [tasks, projects, clients, userNames]);

  /** Rows visible for the current tab, before type/search narrowing. */
  const tabRows = useMemo(() => {
    return rows.filter(r => {
      const declined = isDeclined(r.task);
      if (tab === "declined") return declined;
      if (declined) return false;
      const wt = (r.project as any)?.work_type ?? "project";
      if (tab === "quick") return wt === "request";
      if (tab === "projects") return wt !== "request";
      return true;
    });
  }, [rows, tab]);

  /** Counts per task type within the current tab — drives the filter chips. */
  const typeCounts = useMemo(() => {
    const m = new Map<TaskType, number>();
    for (const r of tabRows) m.set(r.task.type, (m.get(r.task.type) ?? 0) + 1);
    return m;
  }, [tabRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabRows.filter(r => {
      if (typeFilter.size && !typeFilter.has(r.task.type)) return false;
      if (!q) return true;
      const hay = [
        r.task.title,
        r.task.description,
        r.clientName,
        r.requesterName,
        r.project?.title,
        TYPE_LABEL[r.task.type],
        (r.project?.custom_fields as any)?.request_type,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [tabRows, typeFilter, query]);
  const counts = useMemo(() => {
    const open = rows.filter(r => !isDeclined(r.task));

    return {
      all: open.length,
      quick: open.filter(r => ((r.project as any)?.work_type ?? "project") === "request").length,
      projects: open.filter(r => ((r.project as any)?.work_type ?? "project") !== "request").length,
      declined: rows.filter(r => isDeclined(r.task)).length,
    } as Record<TabId, number>;
  }, [rows]);

  // Selection is scoped to the visible tab.
  useEffect(() => { setSelected(new Set()); }, [tab]);
  const visibleIds = filtered.map(r => r.task.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const selectedTasks = filtered.filter(r => selected.has(r.task.id)).map(r => r.task);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkAssign(userId: string | null) {
    for (const t of selectedTasks) {
      await updateTask(t.id, { assignee_id: userId, status: userId ? "claimed" : "unclaimed" });
    }
    toast.success(`${selectedTasks.length} request${selectedTasks.length === 1 ? "" : "s"} assigned`);
    setSelected(new Set());
    reload();
  }

  async function bulkPriority(priority: TaskPriority) {
    for (const t of selectedTasks) await updateTask(t.id, { priority });
    toast.success(`Priority set to ${priority} for ${selectedTasks.length}`);
    setSelected(new Set());
    reload();
  }

  /** Bulk status change — the fast path for closing out dozens of stale requests. */
  async function bulkStatus(status: TaskStatus) {
    const n = selectedTasks.length;
    let failed = 0;
    for (const t of selectedTasks) {
      try { await updateTask(t.id, { status }); } catch { failed++; }
    }
    if (failed === n) toast.error("Couldn't update status");
    else if (failed) toast.warning(`${n - failed} updated, ${failed} failed`);
    else toast.success(`${n} task${n === 1 ? "" : "s"} moved to ${status.replace(/_/g, " ")}`);
    setSelected(new Set());
    reload();
  }


  async function setPriority(task: PmTask, priority: TaskPriority) {
    await updateTask(task.id, { priority });
    toast.success("Priority updated");
    reload();
  }

  async function confirmDecline() {
    if (!declineTarget) return;
    const reason = declineReason.trim();
    if (!reason) { toast.error("Add a short reason so the requester knows why"); return; }
    for (const t of declineTarget) await declineTask(t, reason, user?.id);
    toast.success(`${declineTarget.length} request${declineTarget.length === 1 ? "" : "s"} declined`);
    setDeclineTarget(null);
    setDeclineReason("");
    setSelected(new Set());
    reload();
  }

  return (
    <div className="p-3 md:p-6 max-w-[1200px] mx-auto space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <InboxIcon className="h-5 w-5 text-primary" /> Triage Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Untriaged intake — assign an owner, set priority, convert to a project, or decline. Requests stay visible in Work either way.
        </p>
      </header>

      {/* Filter tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 h-9 text-sm font-medium -mb-px border-b-2 transition flex items-center gap-1.5 whitespace-nowrap",
                t.id === tab
                  ? "border-info text-info"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted tabular-nums">
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + task-type filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative md:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, client, project, requester…"
            className="h-8 pl-8 text-sm"
            aria-label="Search inbox"
          />
        </div>
        <div className="touch-scroll-x no-scrollbar -mx-1 px-1 flex-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {(Object.keys(TYPE_LABEL) as TaskType[])
              .filter(t => (typeCounts.get(t) ?? 0) > 0 || typeFilter.has(t))
              .map(t => {
                const on = typeFilter.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(prev => {
                      const next = new Set(prev);
                      next.has(t) ? next.delete(t) : next.add(t);
                      return next;
                    })}
                    className={cn(
                      "h-8 px-3 rounded-full text-xs border transition-colors whitespace-nowrap shrink-0",
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted",
                    )}
                  >
                    {TYPE_LABEL[t]} ({typeCounts.get(t) ?? 0})
                  </button>
                );
              })}
            {(typeFilter.size > 0 || query) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs shrink-0"
                onClick={() => { setTypeFilter(new Set()); setQuery(""); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedTasks.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 shadow">
          <span className="text-sm font-medium px-1">{selectedTasks.length} selected</span>
          <AssigneePopover
            controlled
            onPick={(id) => bulkAssign(id)}
            trigger={<span className="inline-flex items-center h-8 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">Assign owner</span>}
          />
          <Select onValueChange={(v) => bulkPriority(v as TaskPriority)}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Set priority" /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkStatus(v as TaskStatus)}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Change status" /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => bulkStatus("complete")}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark complete
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-destructive"
            onClick={() => setDeclineTarget(selectedTasks)}
          >
            <Ban className="h-3.5 w-3.5 mr-1" /> Decline
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground p-6">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-1">
          <InboxIcon className="h-7 w-7 mx-auto text-muted-foreground/50" />
          <p className="font-medium">
            {tab === "declined" ? "Nothing declined." : "Your inbox is clear — no untriaged requests."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => setSelected(v ? new Set(visibleIds) : new Set())}
            />
            Select all {filtered.length}
          </label>

          {filtered.map(({ task, project, clientName, requesterName }) => {
            const wt = (project as any)?.work_type ?? "project";
            const reqType = (project?.custom_fields as any)?.request_type as string | undefined;
            const d = declineInfo(task);
            return (
              <Card key={task.id} className={cn("transition", selected.has(task.id) && "ring-1 ring-primary")}>
                <CardContent className="p-3 flex gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selected.has(task.id)}
                    onCheckedChange={() => toggle(task.id)}
                    aria-label={`Select ${task.title}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start gap-2 flex-wrap">
                      <Link
                        to={`/pm/tasks/${task.id}`}
                        className="font-medium text-sm hover:underline break-words"
                      >
                        {task.title}
                      </Link>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted uppercase">
                        {(reqType || wt).replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase">
                        {TYPE_LABEL[task.type]}
                      </span>

                      {d && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                          Declined
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      {clientName && <span>{clientName}</span>}
                      {requesterName && <span>Requested by {requesterName}</span>}
                      <span>Submitted {fmtDate(task.created_at)}</span>
                      {project && (
                        <Link to={`/pm/projects/${project.id}`} className="hover:underline inline-flex items-center gap-1">
                          {project.title} <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>

                    {snippet(task.description) && (
                      <p className="text-xs text-muted-foreground/90">{snippet(task.description)}</p>
                    )}

                    {d && (
                      <p className="text-xs text-destructive/90">
                        Reason: {d.reason} · {fmtDate(d.at)}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {d ? (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={async () => { await restoreTask(task, user?.id); toast.success("Back in the inbox"); reload(); }}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                        </Button>
                      ) : (
                        <>
                          <AssigneePopover
                            taskId={task.id}
                            assigneeId={task.assignee_id}
                            onChanged={reload}
                            trigger={
                              <span className="inline-flex items-center h-7 px-2 rounded-md border border-input bg-background text-xs hover:bg-accent">
                                {task.assignee_id ? userNames.get(task.assignee_id) ?? "Assigned" : "Assign owner"}
                              </span>
                            }
                          />
                          <Select value={task.priority} onValueChange={(v) => setPriority(task, v as TaskPriority)}>
                            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <ClaimButton task={task} onChanged={reload} size="sm" />
                          {project && wt === "request" && (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => setConvertProjectId(project.id)}
                            >
                              <Rocket className="h-3.5 w-3.5 mr-1" /> Convert to project
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                            onClick={() => setDeclineTarget([task])}
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" /> Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!declineTarget} onOpenChange={(o) => { if (!o) { setDeclineTarget(null); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Decline {declineTarget && declineTarget.length > 1 ? `${declineTarget.length} requests` : "request"}
            </DialogTitle>
            <DialogDescription>
              The request stays on record and moves to the Declined tab. Add a reason for the requester.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Why is this being declined?"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeclineTarget(null); setDeclineReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDecline}>Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {convertProjectId && (
        <ConvertToProjectModal
          open
          onOpenChange={(o) => { if (!o) setConvertProjectId(null); }}
          projectId={convertProjectId}
          userId={user?.id ?? null}
          onConverted={() => { setConvertProjectId(null); reload(); }}
        />
      )}
    </div>
  );
}

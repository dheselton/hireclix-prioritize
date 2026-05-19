import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { fmtDate } from "@/lib/pm/format";
import { useMeMode } from "@/hooks/useMeMode";
import { useViewMode } from "@/hooks/useViewMode";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { TaskPreviewPanel } from "./TaskPreviewPanel";
import { STATUS_GROUPS, groupForStatus, typeBadgeClass, priorityDotClass, type StatusGroupId } from "@/lib/pm/statusGroups";
import type { PmTask } from "@/types/pm";

type TypePill = "all" | "design" | "dev" | "qa";

const TYPE_FILTER: Record<Exclude<TypePill, "all">, string[]> = {
  design: ["design", "content"],
  dev: ["dev"],
  qa: ["qa"],
};

export function TasksTab({ tasks, projectId, meId }: {
  tasks: PmTask[]; projectId: string; meId: string | null;
}) {
  const [view, setView] = useViewMode(`project.tasks.${projectId}`, "list");
  const [pill, setPill] = useState<TypePill>("all");
  const { isMe, setMode: setMeMode } = useMeMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<StatusGroupId, boolean>>({
    ready: false, in_progress: false, in_review: false, complete: true,
  });
  const drawer = useTaskDrawerLink();

  const filtered = useMemo(() => {
    let out = tasks;
    if (pill !== "all") out = out.filter(t => TYPE_FILTER[pill].includes(t.type));
    if (isMe && meId) out = out.filter(t => t.assignee_id === meId);
    return out;
  }, [tasks, pill, isMe, meId]);

  const byGroup = useMemo(() => {
    const m: Record<StatusGroupId, PmTask[]> = { ready: [], in_progress: [], in_review: [], complete: [] };
    for (const t of filtered) m[groupForStatus(t.status).id].push(t);
    return m;
  }, [filtered]);

  const selected = filtered.find(t => t.id === selectedId) ?? null;
  const showPreview = !!selected;

  const pills: { id: TypePill | "me"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "design", label: "Design" },
    { id: "dev", label: "Dev" },
    { id: "qa", label: "QA" },
    { id: "me", label: "My Tasks" },
  ];

  function chipCls(active: boolean) {
    return `h-7 px-3 rounded-full text-xs font-medium border transition ${
      active ? "bg-info/10 text-info border-info" : "bg-background text-muted-foreground border-border hover:bg-muted"
    }`;
  }

  return (
    <div className={`grid gap-4 ${showPreview ? "grid-cols-[1fr_280px]" : "grid-cols-1"}`}>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {pills.map(p => {
            const active = p.id === "me" ? isMe : pill === p.id;
            return (
              <button key={p.id} type="button" className={chipCls(active)}
                onClick={() => {
                  if (p.id === "me") setMeMode(isMe ? "all" : "me");
                  else setPill(p.id as TypePill);
                }}>
                {p.label}
              </button>
            );
          })}
          <div className="ml-auto flex gap-1">
            <button type="button" className={chipCls(view === "list")} onClick={() => setView("list")}>List</button>
            <button type="button" className={chipCls(view === "kanban")} onClick={() => setView("kanban")}>Board</button>
          </div>
        </div>

        {/* List */}
        {view === "list" && (
          <div className="space-y-2">
            {STATUS_GROUPS.map(g => {
              const list = byGroup[g.id];
              const isCollapsed = collapsed[g.id];
              return (
                <Card key={g.id}>
                  <CardContent className="p-2">
                    <button type="button"
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40"
                      onClick={() => setCollapsed(c => ({ ...c, [g.id]: !c[g.id] }))}>
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                      <span className={`text-[12px] font-semibold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                      <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{list.length}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1 mt-1">
                        {list.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground italic">No tasks</div>
                        )}
                        {list.map(t => (
                          <TaskRow key={t.id} task={t} groupColorBg={g.bg}
                            selected={t.id === selectedId}
                            onClick={() => setSelectedId(t.id === selectedId ? null : t.id)} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Board */}
        {view === "kanban" && (
          <div className="grid grid-cols-4 gap-3">
            {STATUS_GROUPS.map(g => (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className={`text-[12px] font-semibold uppercase tracking-wide ${g.text}`}>{g.label}</span>
                  <span className="text-[11px] px-1.5 rounded bg-muted text-muted-foreground">{byGroup[g.id].length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {byGroup[g.id].map(t => (
                    <TaskCard key={t.id} task={t} selected={t.id === selectedId}
                      onClick={() => setSelectedId(t.id === selectedId ? null : t.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <TaskPreviewPanel
          task={selected}
          onClose={() => setSelectedId(null)}
          onOpenFull={drawer.open}
        />
      )}
    </div>
  );
}

function TaskRow({ task, groupColorBg, selected, onClick }: {
  task: PmTask; groupColorBg: string; selected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 pl-0 pr-3 py-1.5 rounded border cursor-pointer transition ${
        selected ? "border-info bg-secondary" : "border-transparent hover:border-info"
      }`}
    >
      <div className={`w-[3px] self-stretch rounded-full ${groupColorBg}`} />
      <span className="flex-1 text-[13px] font-medium truncate">{task.title}</span>
      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
        {task.type}
      </span>
      <UserAvatar userId={task.assignee_id} size="xs" />
      <span className="text-[11px] text-muted-foreground w-16 text-right">{fmtDate(task.due_date)}</span>
      <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} title={task.priority} />
    </div>
  );
}

function TaskCard({ task, selected, onClick }: { task: PmTask; selected: boolean; onClick: () => void }) {
  return (
    <Card onClick={onClick}
      className={`cursor-pointer transition ${selected ? "border-info bg-secondary" : "hover:border-info"}`}>
      <CardContent className="p-3 space-y-2">
        <div className="text-[12px] font-bold leading-snug line-clamp-2">{task.title}</div>
        <span className={`inline-block text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
          {task.type}
        </span>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">{fmtDate(task.due_date) || "—"}</span>
          <UserAvatar userId={task.assignee_id} size="xs" />
        </div>
      </CardContent>
    </Card>
  );
}

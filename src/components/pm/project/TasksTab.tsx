import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useSubtaskCounts, type SubtaskCount } from "@/components/pm/SubtaskBadge";
import { fmtDate } from "@/lib/pm/format";
import { useMeMode } from "@/hooks/useMeMode";
import { useViewMode } from "@/hooks/useViewMode";
import { STATUS_GROUPS, groupForStatus, typeBadgeClass, priorityDotClass, type StatusGroupId } from "@/lib/pm/statusGroups";
import type { PmTask, TaskStatus } from "@/types/pm";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { BoardColumn } from "./board/BoardColumn";
import { BoardTaskCard } from "./board/BoardTaskCard";
import { GROUP_PRIMARY_STATUS } from "./board/boardStyles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TypePill = "all" | "design" | "dev" | "qa";

const TYPE_FILTER: Record<Exclude<TypePill, "all">, string[]> = {
  design: ["design", "content"],
  dev: ["dev"],
  qa: ["qa"],
};

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function TasksTab({ tasks, projectId, meId }: {
  tasks: PmTask[]; projectId: string; meId: string | null;
}) {
  const navigate = useNavigate();
  const [view, setView] = useViewMode(`project.tasks.${projectId}`, "list");
  const [pill, setPill] = useState<TypePill>("all");
  const { isMe, setMode: setMeMode } = useMeMode();
  const [collapsed, setCollapsed] = useState<Record<StatusGroupId, boolean>>({
    ready: false, in_progress: false, in_review: false, complete: true,
  });

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

  const counts = useSubtaskCounts(filtered.map(t => t.id));

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

  const openTask = (id: string) => navigate(`/pm/tasks/${id}`);

  return (
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
                        <TaskRow key={t.id} task={t} groupColorBg={g.bg} count={counts.get(t.id)} onClick={() => openTask(t.id)} />
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
                  <TaskCard key={t.id} task={t} count={counts.get(t.id)} onClick={() => openTask(t.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, groupColorBg, count, onClick }: {
  task: PmTask; groupColorBg: string; count?: SubtaskCount; onClick: () => void;
}) {
  const preview = stripHtml(task.description);
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 pl-0 pr-3 py-1.5 rounded border border-transparent cursor-pointer transition hover:border-info"
    >
      <div className={`w-[3px] self-stretch rounded-full ${groupColorBg}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{task.title}</span>
          {count && count.total > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
              {count.done}/{count.total}
            </span>
          )}
        </div>
        {preview && (
          <p className="text-[11px] text-muted-foreground truncate">{preview}</p>
        )}
      </div>
      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
        {task.type}
      </span>
      <UserAvatar userId={task.assignee_id} size="xs" />
      <span className="text-[11px] text-muted-foreground w-16 text-right">{fmtDate(task.due_date)}</span>
      <span className={`h-2 w-2 rounded-full ${priorityDotClass(task.priority)}`} title={task.priority} />
    </div>
  );
}

function TaskCard({ task, count, onClick }: { task: PmTask; count?: SubtaskCount; onClick: () => void }) {
  const preview = stripHtml(task.description);
  return (
    <Card onClick={onClick} className="cursor-pointer transition hover:border-info">
      <CardContent className="p-3 space-y-2 min-h-[110px] flex flex-col">
        <div className="text-[12px] font-bold leading-snug line-clamp-2">{task.title}</div>
        {preview && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{preview}</p>
        )}
        <span className={`inline-block self-start text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(task.type)}`}>
          {task.type}
        </span>
        <div className="flex items-center justify-between pt-1 mt-auto">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{fmtDate(task.due_date) || "—"}</span>
            {count && count.total > 0 && (
              <span>· {count.done}/{count.total} subtasks</span>
            )}
          </div>
          <UserAvatar userId={task.assignee_id} size="xs" />
        </div>
      </CardContent>
    </Card>
  );
}

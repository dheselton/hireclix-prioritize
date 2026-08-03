import { isDone } from "@/types/pm";
import type { PmTask, PmProject, TaskType } from "@/types/pm";
import type { ChipId } from "@/hooks/useChipFilters";

/** Filter tasks by a type allow-list. Empty set = no filter (show all). */
export function applyTaskTypes(tasks: PmTask[], types: Set<TaskType>): PmTask[] {
  if (!types || types.size === 0) return tasks;
  return tasks.filter(t => types.has(t.type));
}

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfWeek = () => { const d = startOfToday(); d.setDate(d.getDate() + 7); return d; };

export function applyTaskMeMode(
  tasks: PmTask[],
  isMe: boolean,
  meId: string | null | undefined,
  coAssignedTaskIds?: Set<string>,
) {
  if (!isMe || !meId) return tasks;
  return tasks.filter(t => t.assignee_id === meId || coAssignedTaskIds?.has(t.id));
}

export function applyTaskChips(
  tasks: PmTask[],
  active: Set<ChipId>,
  meId: string | null | undefined,
  watcherTaskIds?: Set<string>,
  coAssignedTaskIds?: Set<string>,
) {
  if (!active.size) return tasks;
  const today = startOfToday();
  const week = endOfWeek();
  const isMine = (t: PmTask) => !!meId && (t.assignee_id === meId || coAssignedTaskIds?.has(t.id));
  return tasks.filter(t => {
    for (const id of active) {
      switch (id) {
        case "assigned_to_me":
          if (!isMine(t)) return false; break;
        case "created_by_me":
          if (!meId || t.created_by !== meId) return false; break;
        case "watching": {
          if (!watcherTaskIds) return false;
          if (!watcherTaskIds.has(t.id)) return false;
          break;
        }
        case "overdue":
          if (!t.due_date) return false;
          if (new Date(t.due_date) >= today) return false;
          if (isDone(t.status)) return false;
          break;
        case "due_this_week": {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          if (d < today || d > week) return false;
          break;
        }
        case "blocked":
          if (t.status !== "blocked") return false; break;
        case "unclaimed":
          if (t.status !== "unclaimed") return false; break;
      }
    }
    return true;
  });
}

export function applyProjectMeMode(
  projects: PmProject[],
  isMe: boolean,
  meId: string | null | undefined,
  memberProjectIds?: Set<string>,
) {
  if (!isMe || !meId) return projects;
  return projects.filter(p =>
    p.created_by === meId || (memberProjectIds ? memberProjectIds.has(p.id) : false)
  );
}

export function applyProjectChips(
  projects: PmProject[],
  tasks: PmTask[],
  active: Set<ChipId>,
  meId: string | null | undefined,
  memberProjectIds?: Set<string>,
) {
  if (!active.size) return projects;
  const today = startOfToday();
  const week = endOfWeek();
  const blockedByProj = new Set(tasks.filter(t => t.status === "blocked").map(t => t.project_id));
  return projects.filter(p => {
    for (const id of active) {
      switch (id) {
        case "assigned_to_me":
          if (!meId || !memberProjectIds?.has(p.id)) return false; break;
        case "created_by_me":
          if (!meId || p.created_by !== meId) return false; break;
        case "watching":
          return false;
        case "overdue":
          if (!p.go_live_date) return false;
          if (new Date(p.go_live_date) >= today) return false;
          if (p.status === "complete") return false;
          break;
        case "due_this_week": {
          if (!p.go_live_date) return false;
          const d = new Date(p.go_live_date);
          if (d < today || d > week) return false;
          break;
        }
        case "blocked":
          if (!blockedByProj.has(p.id)) return false; break;
      }
    }
    return true;
  });
}

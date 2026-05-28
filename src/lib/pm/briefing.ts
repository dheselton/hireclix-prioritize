import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTasksChanged, emitTasksChanged } from "./refresh";
import type { PmTask, PmProject } from "@/types/pm";

const TERMINAL = new Set(["complete", "approved"]);

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BriefingCounts {
  overdue: number;
  quickTasks: number;
  activeProjects: number;
  blocked: number;
}

interface BriefingData {
  counts: BriefingCounts;
  quickTasks: (PmTask & { project_title: string | null })[];
  projects: (PmProject & {
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    my_top_tasks: PmTask[];
    my_total: number;
  })[];
  loading: boolean;
}

export function useBriefingData(userId: string | null | undefined): BriefingData & { reload: () => void } {
  const [state, setState] = useState<BriefingData>({
    counts: { overdue: 0, quickTasks: 0, activeProjects: 0, blocked: 0 },
    quickTasks: [],
    projects: [],
    loading: true,
  });

  const reload = useCallback(async () => {
    if (!userId) {
      setState({
        counts: { overdue: 0, quickTasks: 0, activeProjects: 0, blocked: 0 },
        quickTasks: [],
        projects: [],
        loading: false,
      });
      return;
    }
    const today = todayIso();

    // 1. All my active tasks (single fetch, used for counts + quick tasks)
    const { data: myTasksRaw } = await supabase
      .from("pm_tasks")
      .select("*")
      .eq("assignee_id", userId);
    const myTasks = ((myTasksRaw ?? []) as PmTask[]).filter((t) => !TERMINAL.has(t.status));

    // 2. Projects map (for work_type lookup + titles)
    const projectIds = Array.from(new Set(myTasks.map((t) => t.project_id)));
    const { data: projRows } = projectIds.length
      ? await supabase.from("pm_projects").select("*").in("id", projectIds)
      : { data: [] as PmProject[] };
    const projById = new Map<string, PmProject>(((projRows ?? []) as PmProject[]).map((p) => [p.id, p]));

    // 3. My membership projects (for Project Work column)
    const { data: memberships } = await supabase
      .from("pm_project_members")
      .select("project_id")
      .eq("user_id", userId);
    const memberProjectIds = new Set<string>((memberships ?? []).map((r: any) => r.project_id));

    // Active projects I'm part of OR created OR have tasks in
    const candidateProjectIds = new Set<string>([
      ...memberProjectIds,
      ...projectIds,
    ]);
    const { data: createdRows } = await supabase
      .from("pm_projects")
      .select("*")
      .or(`created_by.eq.${userId},requested_by.eq.${userId}`);
    ((createdRows ?? []) as PmProject[]).forEach((p) => {
      candidateProjectIds.add(p.id);
      if (!projById.has(p.id)) projById.set(p.id, p);
    });

    const missing = Array.from(candidateProjectIds).filter((id) => !projById.has(id));
    if (missing.length) {
      const { data: extra } = await supabase.from("pm_projects").select("*").in("id", missing);
      ((extra ?? []) as PmProject[]).forEach((p) => projById.set(p.id, p));
    }

    // 4. Counts
    const isRequest = (t: PmTask) => (projById.get(t.project_id) as any)?.work_type === "request";
    const isProject = (t: PmTask) => {
      const wt = (projById.get(t.project_id) as any)?.work_type;
      return wt === "project" || wt == null;
    };

    const overdueTasks = myTasks.filter((t) => t.due_date && t.due_date < today);
    const blocked = myTasks.filter((t) => t.status === "blocked");
    const quickPool = myTasks.filter(isRequest);

    // 5. Quick tasks (top 5)
    const sortByUrgency = (a: PmTask, b: PmTask) => {
      const rank = (t: PmTask) => {
        if (!t.due_date) return 3;
        if (t.due_date < today) return 0;
        if (t.due_date === today) return 1;
        return 2;
      };
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    };
    const quickSorted = [...quickPool].sort(sortByUrgency);
    const quickTop = quickSorted.slice(0, 5).map((t) => ({
      ...t,
      project_title: projById.get(t.project_id)?.title ?? null,
    }));

    // 6. Active projects with aggregates
    const activeProjectList = Array.from(candidateProjectIds)
      .map((id) => projById.get(id))
      .filter((p): p is PmProject => !!p && (p as any).work_type === "project" && p.status === "active");

    let projectsOut: BriefingData["projects"] = [];
    if (activeProjectList.length) {
      const ids = activeProjectList.map((p) => p.id);
      const { data: allTasksRaw } = await supabase
        .from("pm_tasks")
        .select("*")
        .in("project_id", ids);
      const allTasks = (allTasksRaw ?? []) as PmTask[];
      const byProj = new Map<string, PmTask[]>();
      for (const t of allTasks) {
        const arr = byProj.get(t.project_id) ?? [];
        arr.push(t);
        byProj.set(t.project_id, arr);
      }

      projectsOut = activeProjectList.map((p) => {
        const tasks = byProj.get(p.id) ?? [];
        const completed = tasks.filter((t) => TERMINAL.has(t.status)).length;
        const overdue = tasks.filter((t) => t.due_date && t.due_date < today && !TERMINAL.has(t.status)).length;
        const mine = tasks
          .filter((t) => t.assignee_id === userId && !TERMINAL.has(t.status))
          .sort(sortByUrgency);
        return {
          ...p,
          total_tasks: tasks.length,
          completed_tasks: completed,
          overdue_tasks: overdue,
          my_total: mine.length,
          my_top_tasks: mine.slice(0, 3),
        };
      });

      // Sort: projects with overdue first, then by go_live_date
      projectsOut.sort((a, b) => {
        const ao = a.overdue_tasks > 0 ? 0 : 1;
        const bo = b.overdue_tasks > 0 ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return (a.go_live_date ?? "9999").localeCompare(b.go_live_date ?? "9999");
      });
      projectsOut = projectsOut.slice(0, 5);
    }

    setState({
      counts: {
        overdue: overdueTasks.length,
        quickTasks: quickPool.length,
        activeProjects: activeProjectList.length,
        blocked: blocked.length,
      },
      quickTasks: quickTop,
      projects: projectsOut,
      loading: false,
    });
  }, [userId]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    reload();
  }, [reload]);

  useTasksChanged(reload);

  return { ...state, reload };
}

// --- Notes ---

export interface PmNote {
  id: string;
  user_id: string;
  content: string;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

const noteSubs = new Set<() => void>();
function bumpNotes() { noteSubs.forEach((fn) => { try { fn(); } catch {} }); }

export function useMyNotes(userId: string | null | undefined) {
  const [notes, setNotes] = useState<PmNote[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setNotes([]); setLoading(false); return; }
    const { data } = await supabase
      .from("pm_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .order("created_at", { ascending: false });
    setNotes(((data ?? []) as PmNote[]));
    setLoading(false);
  }, [userId]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);
  useEffect(() => {
    const fn = () => reload();
    noteSubs.add(fn);
    return () => { noteSubs.delete(fn); };
  }, [reload]);

  return { notes, loading, reload };
}

export async function createNote(input: { user_id: string; content: string; due_date?: string | null }) {
  const { error } = await supabase.from("pm_notes").insert({
    user_id: input.user_id,
    content: input.content,
    due_date: input.due_date ?? null,
  });
  if (error) throw error;
  bumpNotes();
}

export async function updateNote(id: string, patch: Partial<Pick<PmNote, "content" | "due_date" | "is_completed">>) {
  const { error } = await supabase.from("pm_notes").update(patch).eq("id", id);
  if (error) throw error;
  bumpNotes();
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("pm_notes").delete().eq("id", id);
  if (error) throw error;
  bumpNotes();
}

export { emitTasksChanged };

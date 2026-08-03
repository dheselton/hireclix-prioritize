import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTasksChanged, emitTasksChanged } from "./refresh";
import { getTaskKind, isHighSeverityRisk, isStaleDecision } from "./taskKind";
import type { PmTask, PmProject } from "@/types/pm";
import { isDone } from "@/types/pm";




function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BriefingCounts {
  overdue: number;
  quickTasks: number;
  activeProjects: number;
  blocked: number;
  raidAttention: number;
}

export type EnrichedQuickTask = PmTask & {
  project_title: string | null;
  client_name: string | null;
  request_type: string | null;
};

interface BriefingData {
  counts: BriefingCounts;
  quickTasks: EnrichedQuickTask[];
  unclaimedQuickTasks: EnrichedQuickTask[];
  projects: (PmProject & {
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    my_top_tasks: PmTask[];
    my_total: number;
    team: string[];
  })[];
  loading: boolean;
}

export function useBriefingData(userId: string | null | undefined): BriefingData & { reload: () => void } {
  const [state, setState] = useState<BriefingData>({
    counts: { overdue: 0, quickTasks: 0, activeProjects: 0, blocked: 0, raidAttention: 0 },
    quickTasks: [],
    unclaimedQuickTasks: [],
    projects: [],
    loading: true,
  });

  const reload = useCallback(async () => {
    if (!userId) {
      setState({
        counts: { overdue: 0, quickTasks: 0, activeProjects: 0, blocked: 0, raidAttention: 0 },
        quickTasks: [],
        unclaimedQuickTasks: [],
        projects: [],
        loading: false,
      });
      return;
    }
    const today = todayIso();

    // 1. All my active tasks — primary owner OR co-assignee
    const { data: coRows } = await supabase
      .from("pm_task_assignees")
      .select("task_id")
      .eq("user_id", userId);
    const coTaskIds = Array.from(new Set(((coRows ?? []) as Array<{ task_id: string }>).map(r => r.task_id)));
    const [{ data: primaryRaw }, { data: coTasksRaw }] = await Promise.all([
      supabase.from("pm_tasks").select("*").eq("assignee_id", userId),
      coTaskIds.length
        ? supabase.from("pm_tasks").select("*").in("id", coTaskIds)
        : Promise.resolve({ data: [] as PmTask[] } as any),
    ]);
    const byId = new Map<string, PmTask>();
    for (const t of ([...(primaryRaw ?? []), ...(coTasksRaw ?? [])] as PmTask[])) byId.set(t.id, t);
    const myTasks = Array.from(byId.values()).filter((t) => !isDone(t.status));

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
    const quickTopRaw = quickSorted.slice(0, 5);

    // 5b. Unclaimed quick tasks (visible to everyone)
    const { data: unclaimedRaw } = await supabase
      .from("pm_tasks")
      .select("*")
      .eq("status", "unclaimed");
    const unclaimedAll = (unclaimedRaw ?? []) as unknown as PmTask[];
    // Need work_type lookup for these projects too
    const unclaimedProjIds = Array.from(new Set(unclaimedAll.map((t) => t.project_id)))
      .filter((id) => !projById.has(id));
    if (unclaimedProjIds.length) {
      const { data: extraProj } = await supabase
        .from("pm_projects").select("*").in("id", unclaimedProjIds);
      ((extraProj ?? []) as PmProject[]).forEach((p) => projById.set(p.id, p));
    }
    const unclaimedQuickRaw = unclaimedAll
      .filter((t) => (projById.get(t.project_id) as any)?.work_type === "request")
      .sort(sortByUrgency);

    // 5c. Resolve client names for all referenced projects
    const allClientIds = new Set<string>();
    [...quickTopRaw, ...unclaimedQuickRaw].forEach((t) => {
      const cid = (projById.get(t.project_id) as any)?.client_id;
      if (cid) allClientIds.add(cid);
    });
    const clientNameById = new Map<string, string>();
    if (allClientIds.size) {
      const { data: cRows } = await supabase
        .from("clients").select("id, name").in("id", Array.from(allClientIds));
      ((cRows ?? []) as Array<{ id: string; name: string }>).forEach((c) =>
        clientNameById.set(c.id, c.name)
      );
    }

    const enrich = (t: PmTask): EnrichedQuickTask => {
      const p: any = projById.get(t.project_id);
      return {
        ...t,
        project_title: p?.title ?? null,
        client_name: p?.client_id ? clientNameById.get(p.client_id) ?? null : null,
        request_type: p?.custom_fields?.request_type ?? null,
      };
    };
    const quickTop = quickTopRaw.map(enrich);
    const unclaimedQuick = unclaimedQuickRaw.map(enrich);

    // 6. Active projects with aggregates
    const activeProjectList = Array.from(candidateProjectIds)
      .map((id) => projById.get(id))
      .filter((p): p is PmProject => !!p && (p as any).work_type === "project" && p.status === "active");

    // 6b. Fetch project members for all candidate projects (for team avatars)
    const teamByProj = new Map<string, string[]>();
    if (activeProjectList.length) {
      const { data: members } = await supabase
        .from("pm_project_members")
        .select("project_id, user_id")
        .in("project_id", activeProjectList.map((p) => p.id));
      for (const r of (members ?? []) as Array<{ project_id: string; user_id: string }>) {
        const arr = teamByProj.get(r.project_id) ?? [];
        if (!arr.includes(r.user_id)) arr.push(r.user_id);
        teamByProj.set(r.project_id, arr);
      }
    }

    let projectsOut: BriefingData["projects"] = [];
    if (activeProjectList.length) {
      const ids = activeProjectList.map((p) => p.id);
      const { data: allTasksRaw } = await supabase
        .from("pm_tasks")
        .select("*")
        .in("project_id", ids);
      const allTasks = (allTasksRaw ?? []) as unknown as PmTask[];
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
          .filter((t) => (t.assignee_id === userId || coTaskIds.includes(t.id)) && !TERMINAL.has(t.status))
          .sort(sortByUrgency);
        return {
          ...p,
          total_tasks: tasks.length,
          completed_tasks: completed,
          overdue_tasks: overdue,
          my_total: mine.length,
          my_top_tasks: mine.slice(0, 3),
          team: teamByProj.get(p.id) ?? [],
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

    // 7. RAID needing attention — stale decisions + high-severity risks across projects I can see
    let raidAttention = 0;
    try {
      const ids = activeProjectList.map((p) => p.id);
      if (ids.length) {
        const { data: raidRaw } = await supabase
          .from("pm_tasks")
          .select("*")
          .in("project_id", ids);
        for (const t of (raidRaw ?? []) as PmTask[]) {
          if (isStaleDecision(t) || isHighSeverityRisk(t)) raidAttention++;
        }
      }
    } catch {}

    setState({
      counts: {
        overdue: overdueTasks.length,
        quickTasks: quickPool.length,
        activeProjects: activeProjectList.length,
        blocked: blocked.length,
        raidAttention,
      },
      quickTasks: quickTop,
      unclaimedQuickTasks: unclaimedQuick,
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

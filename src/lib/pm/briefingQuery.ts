import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTaskAssigneesQuery } from "@/lib/pm/assignees";
import { useProjectTeamsQuery } from "@/lib/pm/projectTeam";
import { useProjectsQuery, useTasksQuery } from "@/lib/pm/queries";
import { isHighSeverityRisk, isStaleDecision } from "@/lib/pm/taskKind";
import { isHardOverdue, dueState } from "@/lib/pm/dueState";
import { isDone, type PmProject, type PmTask } from "@/types/pm";

export interface CachedBriefingData {
  counts: {
    overdue: number;
    quickTasks: number;
    activeProjects: number;
    blocked: number;
    raidAttention: number;
  };
  quickTasks: Array<PmTask & {
    project_title: string | null;
    client_name: string | null;
    request_type: string | null;
  }>;
  unclaimedQuickTasks: CachedBriefingData["quickTasks"];
  projects: Array<PmProject & {
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    my_top_tasks: PmTask[];
    my_total: number;
    team: string[];
  }>;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

const EMPTY_COUNTS = { overdue: 0, quickTasks: 0, activeProjects: 0, blocked: 0, raidAttention: 0 };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useCachedBriefingData(userId: string | null | undefined): CachedBriefingData {
  const tasksQuery = useTasksQuery();
  const projectsQuery = useProjectsQuery();
  const assigneesQuery = useTaskAssigneesQuery();
  const teamsQuery = useProjectTeamsQuery();
  const clientsQuery = useQuery({
    queryKey: ["pm", "clients", "names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) throw error;
      return new Map((data ?? []).map(row => [row.id, row.name] as const));
    },
    enabled: !!userId,
  });
  const refetchTasks = tasksQuery.refetch;
  const refetchProjects = projectsQuery.refetch;
  const refetchAssignees = assigneesQuery.refetch;
  const refetchTeams = teamsQuery.refetch;
  const refetchClients = clientsQuery.refetch;

  const reload = useCallback(() => {
    void refetchTasks();
    void refetchProjects();
    void refetchAssignees();
    void refetchTeams();
    void refetchClients();
  }, [
    refetchTasks,
    refetchProjects,
    refetchAssignees,
    refetchTeams,
    refetchClients,
  ]);

  const loading = !!userId && (
    tasksQuery.isPending ||
    projectsQuery.isPending ||
    assigneesQuery.isPending ||
    teamsQuery.isPending ||
    clientsQuery.isPending
  );
  const error = (
    tasksQuery.isError ||
    projectsQuery.isError ||
    assigneesQuery.isError ||
    teamsQuery.isError ||
    clientsQuery.isError
  );

  return useMemo(() => {
    if (!userId || loading || error) {
      return {
        counts: EMPTY_COUNTS,
        quickTasks: [],
        unclaimedQuickTasks: [],
        projects: [],
        loading,
        error,
        reload,
      };
    }

    const today = todayIso();
    const allTasks = tasksQuery.data ?? [];
    const allProjects = projectsQuery.data ?? [];
    const assignees = assigneesQuery.data ?? new Map<string, string[]>();
    const teamsByProject = teamsQuery.data ?? new Map<string, string[]>();
    const clientNames = clientsQuery.data ?? new Map<string, string>();
    const projectsById = new Map(allProjects.map(project => [project.id, project]));

    const coTaskIds = new Set<string>();
    assignees.forEach((users, taskId) => {
      if (users.includes(userId)) coTaskIds.add(taskId);
    });
    const mine = (task: PmTask) => task.assignee_id === userId || coTaskIds.has(task.id);
    const myTasks = allTasks.filter(task => mine(task) && !isDone(task.status));
    const myTaskProjectIds = new Set(myTasks.map(task => task.project_id));
    const candidateProjects = allProjects.filter(project =>
      myTaskProjectIds.has(project.id) ||
      teamsByProject.get(project.id)?.includes(userId) ||
      project.created_by === userId ||
      project.requested_by === userId,
    );

    const isRequest = (task: PmTask) => projectsById.get(task.project_id)?.work_type === "request";
    const urgency = (task: PmTask) => {
      const state = dueState(task, today);
      if (state === "overdue") return 0;
      if (state === "slipped") return 1;
      if (state === "today") return 2;
      if (state === "upcoming") return 3;
      return 4;
    };
    const sortUrgent = (a: PmTask, b: PmTask) =>
      urgency(a) - urgency(b) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

    const enrich = (task: PmTask) => {
      const project = projectsById.get(task.project_id);
      const fields = project?.custom_fields as Record<string, unknown> | null;
      return {
        ...task,
        project_title: project?.title ?? null,
        client_name: project?.client_id ? clientNames.get(project.client_id) ?? null : null,
        request_type: typeof fields?.request_type === "string" ? fields.request_type : null,
      };
    };

    const quickPool = myTasks.filter(isRequest);
    const quickTasks = [...quickPool].sort(sortUrgent).slice(0, 5).map(enrich);
    const unclaimedQuickTasks = allTasks
      .filter(task => task.status === "unclaimed" && isRequest(task))
      .sort(sortUrgent)
      .map(enrich);

    const activeProjects = candidateProjects.filter(project =>
      project.work_type === "project" && project.status === "active",
    );
    const activeIds = new Set(activeProjects.map(project => project.id));
    const tasksByProject = new Map<string, PmTask[]>();
    for (const task of allTasks) {
      if (!activeIds.has(task.project_id)) continue;
      const rows = tasksByProject.get(task.project_id) ?? [];
      rows.push(task);
      tasksByProject.set(task.project_id, rows);
    }

    const projects = activeProjects.map(project => {
      const projectTasks = tasksByProject.get(project.id) ?? [];
      const myOpen = projectTasks.filter(task => mine(task) && !isDone(task.status)).sort(sortUrgent);
      return {
        ...project,
        total_tasks: projectTasks.length,
        completed_tasks: projectTasks.filter(task => isDone(task.status)).length,
        overdue_tasks: projectTasks.filter(task => isHardOverdue(task, today)).length,
        my_top_tasks: myOpen.slice(0, 3),
        my_total: myOpen.length,
        team: teamsByProject.get(project.id) ?? [],
      };
    }).sort((a, b) => {
      const risk = Number(b.overdue_tasks > 0) - Number(a.overdue_tasks > 0);
      return risk || (a.go_live_date ?? "9999").localeCompare(b.go_live_date ?? "9999");
    }).slice(0, 5);

    const raidAttention = allTasks.filter(task =>
      activeIds.has(task.project_id) &&
      (isStaleDecision(task) || isHighSeverityRisk(task)),
    ).length;

    return {
      counts: {
        overdue: myTasks.filter(task => isHardOverdue(task, today)).length,
        quickTasks: quickPool.length,
        activeProjects: activeProjects.length,
        blocked: myTasks.filter(task => task.status === "blocked").length,
        raidAttention,
      },
      quickTasks,
      unclaimedQuickTasks,
      projects,
      loading: false,
      error: false,
      reload,
    };
  }, [
    userId,
    loading,
    error,
    tasksQuery.data,
    projectsQuery.data,
    assigneesQuery.data,
    teamsQuery.data,
    clientsQuery.data,
    reload,
  ]);
}

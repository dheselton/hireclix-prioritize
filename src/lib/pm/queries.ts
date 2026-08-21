import { useQuery } from "@tanstack/react-query";
import { fetchDependencies, fetchPhases, fetchProject, fetchProjects, fetchTasks } from "@/lib/pm/api";
import { queryClient } from "@/lib/queryClient";
import type { PmProject, PmTask } from "@/types/pm";

export const EMPTY_TASKS: PmTask[] = [];
export const EMPTY_PROJECTS: PmProject[] = [];

export const pmQueryKeys = {
  root: ["pm"] as const,
  tasks: () => [...pmQueryKeys.root, "tasks"] as const,
  allTasks: () => [...pmQueryKeys.tasks(), "all"] as const,
  projectTasks: (projectId: string) => [...pmQueryKeys.tasks(), "project", projectId] as const,
  projects: () => [...pmQueryKeys.root, "projects"] as const,
  allProjects: () => [...pmQueryKeys.projects(), "all"] as const,
  project: (projectId: string) => [...pmQueryKeys.projects(), "detail", projectId] as const,
  phases: (projectId: string) => [...pmQueryKeys.project(projectId), "phases"] as const,
  dependencies: (projectId: string) => [...pmQueryKeys.project(projectId), "dependencies"] as const,
};

export function useTasksQuery() {
  return useQuery({
    queryKey: pmQueryKeys.allTasks(),
    queryFn: () => fetchTasks(),
  });
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: pmQueryKeys.allProjects(),
    queryFn: fetchProjects,
  });
}

export function useProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: pmQueryKeys.project(projectId ?? "missing"),
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
    initialData: () => queryClient
      .getQueryData<PmProject[]>(pmQueryKeys.allProjects())
      ?.find(project => project.id === projectId),
  });
}

export function useProjectTasksQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: pmQueryKeys.projectTasks(projectId ?? "missing"),
    queryFn: () => fetchTasks(projectId!),
    enabled: !!projectId,
    initialData: () => queryClient
      .getQueryData<PmTask[]>(pmQueryKeys.allTasks())
      ?.filter(task => task.project_id === projectId),
  });
}

export function useProjectPhasesQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: pmQueryKeys.phases(projectId ?? "missing"),
    queryFn: () => fetchPhases(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectDependenciesQuery(projectId: string | undefined, taskIds: string[], ready = true) {
  return useQuery({
    queryKey: pmQueryKeys.dependencies(projectId ?? "missing"),
    queryFn: () => fetchDependencies(projectId!, taskIds),
    enabled: !!projectId && ready,
  });
}

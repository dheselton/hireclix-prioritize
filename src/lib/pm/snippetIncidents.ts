import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import { createTask } from "@/lib/pm/api";
import { emitTasksChanged } from "@/lib/pm/refresh";
import type { TaskPriority, TaskStatus } from "@/types/pm";
import { TERMINAL_STATUSES } from "@/types/pm";
import { isoDateOffset } from "@/lib/pm/format";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type SnippetIncident = {
  id: string;
  snippet_id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  reported_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const DONE_STATUSES: TaskStatus[] = TERMINAL_STATUSES;

export const severityToPriority = (s: IncidentSeverity): TaskPriority =>
  s === "critical" ? "urgent" : s === "low" ? "low" : s === "medium" ? "medium" : "high";

export const severityDueOffsetDays = (s: IncidentSeverity): number =>
  s === "critical" ? 1 : s === "high" ? 2 : s === "medium" ? 5 : 7;



/** Fetch projects that currently use this snippet, with one open task count per project. */
export async function fetchSnippetSites(snippetId: string) {
  const { data, error } = await supabase
    .from("pm_task_snippets")
    .select("task:pm_tasks(id, status, project_id, pm_projects(id, title, clients(name)))")
    .eq("snippet_id", snippetId);
  if (error) throw error;

  type Row = {
    projectId: string;
    projectTitle: string;
    clientName: string | null;
    openTasks: number;
  };
  const map = new Map<string, Row>();
  ((data ?? []) as any[]).forEach(r => {
    const t = r.task;
    if (!t?.pm_projects) return;
    const id = t.pm_projects.id;
    const cur = map.get(id) ?? {
      projectId: id,
      projectTitle: t.pm_projects.title,
      clientName: t.pm_projects.clients?.name ?? null,
      openTasks: 0,
    };
    if (!DONE_STATUSES.includes(t.status)) cur.openTasks += 1;
    map.set(id, cur);
  });
  return Array.from(map.values()).sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));
}

export type CreateIncidentInput = {
  snippetId: string;
  snippetTitle: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  sites: { projectId: string; projectTitle: string; assigneeId: string | null }[];
};

export async function createSnippetIncident(input: CreateIncidentInput): Promise<{
  incident: SnippetIncident;
  taskIds: string[];
}> {
  const { data: incident, error } = await supabase
    .from("pm_snippet_incidents")
    .insert({
      snippet_id: input.snippetId,
      title: input.title,
      description: input.description || null,
      severity: input.severity,
      reported_by: getCurrentUserId(),
    })
    .select()
    .single();
  if (error) throw error;

  const priority = severityToPriority(input.severity);
  const due = isoDateOffset(severityDueOffsetDays(input.severity));
  const taskIds: string[] = [];

  for (const site of input.sites) {
    const t = await createTask({
      project_id: site.projectId,
      title: `[Broken snippet] ${input.snippetTitle} — ${site.projectTitle}`,
      description: input.description,
      type: "dev",
      priority,
      due_date: due,
      assignee_id: site.assigneeId ?? null,
      status: site.assigneeId ? "claimed" : ("unclaimed" as TaskStatus),
      custom_fields: {
        snippet_incident_id: incident.id,
        snippet_id: input.snippetId,
        is_incident: true,
      } as any,
    } as any);
    taskIds.push(t.id);
    await supabase
      .from("pm_task_snippets")
      .insert({ task_id: t.id, snippet_id: input.snippetId, linked_by: getCurrentUserId() });
  }
  emitTasksChanged();
  return { incident: incident as SnippetIncident, taskIds };
}

export async function resolveIncident(id: string) {
  const { error } = await supabase
    .from("pm_snippet_incidents")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reopenIncident(id: string) {
  const { error } = await supabase
    .from("pm_snippet_incidents")
    .update({ resolved_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchActiveIncidentForSnippet(snippetId: string): Promise<SnippetIncident | null> {
  const { data, error } = await supabase
    .from("pm_snippet_incidents")
    .select("*")
    .eq("snippet_id", snippetId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as SnippetIncident) ?? null;
}

export async function fetchIncident(id: string): Promise<SnippetIncident | null> {
  const { data, error } = await supabase
    .from("pm_snippet_incidents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SnippetIncident) ?? null;
}

export type IncidentSibling = {
  taskId: string;
  taskTitle: string;
  status: TaskStatus;
  assigneeId: string | null;
  projectId: string;
  projectTitle: string;
  dueDate: string | null;
};

export async function fetchIncidentSiblings(incidentId: string): Promise<IncidentSibling[]> {
  const { data, error } = await supabase
    .from("pm_tasks")
    .select("id, title, status, assignee_id, project_id, due_date, pm_projects(title)")
    .filter("custom_fields->>snippet_incident_id", "eq", incidentId);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      status: t.status,
      assigneeId: t.assignee_id,
      projectId: t.project_id,
      projectTitle: t.pm_projects?.title ?? "Project",
      dueDate: t.due_date,
    }))
    .sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));
}

export async function fetchAllIncidents(): Promise<
  (SnippetIncident & { snippet_title: string; siblings: IncidentSibling[] })[]
> {
  const { data, error } = await supabase
    .from("pm_snippet_incidents")
    .select("*, snippet:pm_snippets(title)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const withSiblings = await Promise.all(
    rows.map(async r => ({
      ...(r as SnippetIncident),
      snippet_title: r.snippet?.title ?? "Snippet",
      siblings: await fetchIncidentSiblings(r.id),
    })),
  );
  return withSiblings;
}

export function isSiblingDone(s: IncidentSibling) {
  return DONE_STATUSES.includes(s.status);
}

/* react-query hooks */

export function useSnippetActiveIncident(snippetId: string) {
  return useQuery({
    queryKey: ["snippet-incident-active", snippetId],
    queryFn: () => fetchActiveIncidentForSnippet(snippetId),
    staleTime: 30_000,
  });
}

export function useIncidentSiblings(incidentId: string | null | undefined) {
  return useQuery({
    queryKey: ["snippet-incident-siblings", incidentId],
    queryFn: () => fetchIncidentSiblings(incidentId!),
    enabled: !!incidentId,
    staleTime: 15_000,
  });
}

export function useIncident(incidentId: string | null | undefined) {
  return useQuery({
    queryKey: ["snippet-incident", incidentId],
    queryFn: () => fetchIncident(incidentId!),
    enabled: !!incidentId,
    staleTime: 30_000,
  });
}

export function useSnippetSites(snippetId: string, enabled = true) {
  return useQuery({
    queryKey: ["snippet-sites", snippetId],
    queryFn: () => fetchSnippetSites(snippetId),
    enabled,
    staleTime: 15_000,
  });
}

export function useAllIncidents() {
  return useQuery({
    queryKey: ["snippet-incidents-all"],
    queryFn: fetchAllIncidents,
    staleTime: 30_000,
  });
}

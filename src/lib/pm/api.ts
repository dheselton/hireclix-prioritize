import { supabase } from '@/integrations/supabase/client';
import { emitTasksChanged } from '@/lib/pm/refresh';
import { getCurrentUserId } from '@/lib/pm/mockUser';
import type { PmProject, PmTask, PmPhase, PmDependency } from '@/types/pm';

export const fetchProjects = async () => {
  const { data, error } = await supabase.from('pm_projects').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as PmProject[];
};

export const fetchProject = async (id: string) => {
  const { data, error } = await supabase.from('pm_projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as PmProject | null;
};

export const fetchTasks = async (
  projectId?: string,
  opts?: { types?: string[] },
) => {
  let q = supabase.from('pm_tasks').select('*').order('sort_order');
  if (projectId) q = q.eq('project_id', projectId);
  if (opts?.types && opts.types.length) q = q.in('type', opts.types);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as PmTask[];
};

export const fetchPhases = async (projectId: string) => {
  const { data, error } = await supabase.from('pm_project_phases').select('*').eq('project_id', projectId).order('sort_order');
  if (error) throw error;
  return (data || []) as PmPhase[];
};

export const fetchDependencies = async (projectId: string) => {
  // get all tasks for project, then deps that touch them
  const tasks = await fetchTasks(projectId);
  const ids = tasks.map(t => t.id);
  if (!ids.length) return [];
  const { data, error } = await supabase.from('pm_task_dependencies').select('*').in('task_id', ids);
  if (error) throw error;
  return (data || []) as PmDependency[];
};

export const updateTask = async (id: string, patch: Partial<PmTask>) => {
  const { data, error } = await supabase.from('pm_tasks').update(patch as any).eq('id', id).select().single();
  if (error) throw error;
  emitTasksChanged();
  return data as unknown as PmTask;
};

export const createTask = async (task: Partial<PmTask>) => {
  const uid = getCurrentUserId();
  const payload: any = { ...task };
  if (uid) {
    if (payload.created_by === undefined) payload.created_by = uid;
    // Auto-assign creator to the task they create (any role, incl. submitter/PM).
    if (payload.assignee_id === undefined || payload.assignee_id === null) {
      payload.assignee_id = uid;
      if (!payload.status || payload.status === 'unclaimed') payload.status = 'claimed';
    }
  }
  const { data, error } = await supabase.from('pm_tasks').insert(payload).select().single();
  if (error) throw error;
  emitTasksChanged();
  return data as unknown as PmTask;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase.from('pm_tasks').delete().eq('id', id);
  if (error) throw error;
  emitTasksChanged();
};

export const updateProject = async (id: string, patch: Partial<PmProject>) => {
  const { data, error } = await supabase.from('pm_projects').update(patch as any).eq('id', id).select().single();
  if (error) throw error;
  return data as unknown as PmProject;
};

export const createProject = async (p: Partial<PmProject>) => {
  const uid = getCurrentUserId();
  const payload: any = { ...p };
  if (uid && payload.created_by === undefined) payload.created_by = uid;
  const { data, error } = await supabase.from('pm_projects').insert(payload).select().single();
  if (error) throw error;
  // Ensure creator is a project member so they're "assigned" to the project.
  if (uid && (data as any)?.id) {
    await supabase.from('pm_project_members').insert({
      project_id: (data as any).id,
      user_id: uid,
      role: 'creator',
    } as any);
  }
  return data as unknown as PmProject;
};

export const logActivity = async (params: { project_id?: string; task_id?: string; user_id?: string | null; action: string; payload?: any }) => {
  await supabase.from('pm_activity_log').insert({
    project_id: params.project_id ?? null,
    task_id: params.task_id ?? null,
    user_id: params.user_id ?? null,
    action: params.action,
    payload: params.payload ?? {},
  } as any);
};

// ============================================================================
// Template instantiation + schedule diffs
// ============================================================================

import { scheduleForwardFromKickoff, fitToWindow, type ScheduleTask, type ScheduleDep, type DateDiff } from '@/lib/pm/scheduler';

export interface PreviewTask extends ScheduleTask {
  temp_id: string;
  phase_name: string | null;
  type: string;
  assignee_role: string | null;
  sort_order: number;
}

export const fetchTemplateBundle = async (templateId: string) => {
  const [{ data: tpl }, { data: tts }, { data: tdeps }] = await Promise.all([
    supabase.from('pm_project_templates').select('*').eq('id', templateId).maybeSingle(),
    supabase.from('pm_template_tasks').select('*').eq('template_id', templateId).order('sort_order'),
    supabase.from('pm_template_dependencies').select('*').eq('template_id', templateId),
  ]);
  return { template: tpl, tasks: (tts || []) as any[], deps: (tdeps || []) as any[] };
};

/** Build preview tasks + deps keyed by temp_id, ready for scheduler. */
export const buildPreviewFromTemplate = (tasks: any[], deps: any[]) => {
  const previewTasks: PreviewTask[] = tasks.map(t => ({
    id: t.temp_id,
    temp_id: t.temp_id,
    title: t.title,
    duration_days: t.duration_days,
    min_duration_days: t.min_duration_days,
    locked: !!t.locked,
    locked_to_kickoff: !!t.locked_to_kickoff,
    locked_to_go_live: !!t.locked_to_go_live,
    phase_name: t.phase_name,
    type: t.type,
    assignee_role: t.assignee_role,
    sort_order: t.sort_order,
  }));
  const previewDeps: ScheduleDep[] = deps.map(d => ({
    task_id: d.to_temp_id,
    depends_on_task_id: d.from_temp_id,
    type: d.type,
    lag_days: d.lag_days || 0,
  }));
  return { previewTasks, previewDeps };
};

/** Insert phases/tasks/dependencies from a template-bundle preview into an existing project. */
const instantiateTemplateIntoProject = async (params: {
  projectId: string;
  previewTasks: PreviewTask[];
  previewDeps: ScheduleDep[];
  placement: Map<string, { start: Date; end: Date; duration: number }>;
  sortOffset?: number;
}) => {
  const { projectId, previewTasks, previewDeps, placement, sortOffset = 0 } = params;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Phases
  const phaseNames = Array.from(new Set(previewTasks.map(t => t.phase_name).filter(Boolean))) as string[];
  const phaseRows = phaseNames.map((name, i) => ({ project_id: projectId, name, sort_order: (i + 1) * 10 }));
  const phaseIdByName = new Map<string, string>();
  if (phaseRows.length) {
    const { data: phs } = await supabase.from('pm_project_phases').insert(phaseRows as any).select();
    for (const p of phs || []) phaseIdByName.set((p as any).name, (p as any).id);
  }

  // Tasks
  const taskRows = previewTasks.map(pt => {
    const placed = placement.get(pt.temp_id);
    return {
      project_id: projectId,
      phase_id: pt.phase_name ? phaseIdByName.get(pt.phase_name) ?? null : null,
      title: pt.title,
      type: pt.type,
      status: 'unclaimed',
      priority: 'medium',
      duration_days: placed?.duration ?? pt.duration_days,
      min_duration_days: pt.min_duration_days ?? null,
      locked: !!pt.locked,
      locked_to_kickoff: !!pt.locked_to_kickoff,
      locked_to_go_live: !!pt.locked_to_go_live,
      start_date: placed ? fmt(placed.start) : null,
      due_date: placed ? fmt(placed.end) : null,
      sort_order: pt.sort_order + sortOffset,
    };
  });
  const { data: insertedTasks, error: te } = await supabase.from('pm_tasks').insert(taskRows as any).select();
  if (te) throw te;

  // Map temp_id -> real task id
  const idByTemp = new Map<string, string>();
  for (const pt of previewTasks) {
    const match = (insertedTasks || []).find((it: any) =>
      it.title === pt.title && it.sort_order === pt.sort_order + sortOffset,
    );
    if (match) idByTemp.set(pt.temp_id, (match as any).id);
  }

  // Dependencies
  const depRows = previewDeps
    .map(d => ({
      task_id: idByTemp.get(d.task_id),
      depends_on_task_id: idByTemp.get(d.depends_on_task_id),
      type: d.type,
      lag_days: d.lag_days || 0,
    }))
    .filter(d => d.task_id && d.depends_on_task_id);
  if (depRows.length) await supabase.from('pm_task_dependencies').insert(depRows as any);
};

/** Create a project from template + scheduled placement (already computed). */
export const createProjectFromTemplate = async (params: {
  template: any;
  previewTasks: PreviewTask[];
  previewDeps: ScheduleDep[];
  placement: Map<string, { start: Date; end: Date; duration: number }>;
  kickoff: string;
  goLive: string;
  title?: string;
  client_id?: string | null;
}) => {
  const { template, previewTasks, previewDeps, placement, kickoff, goLive, title, client_id } = params;

  const uid = getCurrentUserId();
  const { data: proj, error: pe } = await supabase.from('pm_projects').insert({
    title: title || `${template.name} — ${new Date().toLocaleDateString()}`,
    type: template.type,
    work_type: 'project',
    status: 'active',
    template_id: template.id,
    client_id: client_id ?? null,
    kickoff_date: kickoff,
    start_date: kickoff,
    go_live_date: goLive,
    created_by: uid ?? null,
  } as any).select().single();
  if (pe || !proj) throw pe;

  if (uid) {
    await supabase.from('pm_project_members').insert({
      project_id: (proj as any).id, user_id: uid, role: 'creator',
    } as any);
  }

  await instantiateTemplateIntoProject({
    projectId: (proj as any).id,
    previewTasks, previewDeps, placement,
  });

  emitTasksChanged();
  return proj as unknown as PmProject;
};

/** Convert a request project into a full project by applying a template. */
export const convertRequestToProject = async (params: {
  projectId: string;
  template: any;
  previewTasks: PreviewTask[];
  previewDeps: ScheduleDep[];
  placement: Map<string, { start: Date; end: Date; duration: number }>;
  kickoff: string;
  goLive: string;
}) => {
  const { projectId, template, previewTasks, previewDeps, placement, kickoff, goLive } = params;

  await supabase.from('pm_projects').update({
    work_type: 'project',
    type: template.type,
    template_id: template.id,
    kickoff_date: kickoff,
    start_date: kickoff,
    go_live_date: goLive,
  } as any).eq('id', projectId);

  await instantiateTemplateIntoProject({
    projectId, previewTasks, previewDeps, placement,
    sortOffset: 1000, // existing request tasks keep their sort order at top
  });

  emitTasksChanged();
};

/** Apply scheduler diffs to live tasks. */
export const applyScheduleDiffs = async (diffs: DateDiff[]) => {
  for (const d of diffs) {
    await supabase.from('pm_tasks').update({ start_date: d.newStart, due_date: d.newEnd } as any).eq('id', d.taskId);
  }
  emitTasksChanged();
};

import { supabase } from '@/integrations/supabase/client';
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

export const fetchTasks = async (projectId?: string) => {
  let q = supabase.from('pm_tasks').select('*').order('sort_order');
  if (projectId) q = q.eq('project_id', projectId);
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
  return data as unknown as PmTask;
};

export const createTask = async (task: Partial<PmTask>) => {
  const { data, error } = await supabase.from('pm_tasks').insert(task as any).select().single();
  if (error) throw error;
  return data as unknown as PmTask;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase.from('pm_tasks').delete().eq('id', id);
  if (error) throw error;
};

export const updateProject = async (id: string, patch: Partial<PmProject>) => {
  const { data, error } = await supabase.from('pm_projects').update(patch as any).eq('id', id).select().single();
  if (error) throw error;
  return data as unknown as PmProject;
};

export const createProject = async (p: Partial<PmProject>) => {
  const { data, error } = await supabase.from('pm_projects').insert(p as any).select().single();
  if (error) throw error;
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

import { supabase } from '@/integrations/supabase/client';
import { emitTasksChanged } from '@/lib/pm/refresh';
import { getCurrentUserId } from '@/lib/pm/mockUser';
import type { PmProject, PmTask, PmPhase, PmDependency } from '@/types/pm';
import { localDateISO } from '@/lib/pm/format';

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
  // Load prior state for change detection
  const { data: prev } = await supabase.from('pm_tasks').select('assignee_id, status, title, project_id').eq('id', id).maybeSingle();
  const { data, error } = await supabase.from('pm_tasks').update(patch as any).eq('id', id).select().single();
  if (error) throw error;
  emitTasksChanged();
  // Fire notifications (best-effort; never block on failure)
  try {
    const { createNotification } = await import('./notifications');
    const actor = getCurrentUserId();
    const newAssignee = (data as any).assignee_id as string | null;
    const oldAssignee = (prev as any)?.assignee_id as string | null | undefined;
    const link = `/pm/tasks/${id}`;
    if (newAssignee && newAssignee !== oldAssignee && newAssignee !== actor) {
      await createNotification({
        user_id: newAssignee,
        event_type: 'assigned',
        title: `Assigned: ${(data as any).title}`,
        body: 'You were assigned to a task',
        link,
      });
    }
    const newStatus = (data as any).status as string;
    const oldStatus = (prev as any)?.status as string | undefined;
    if (newStatus && oldStatus && newStatus !== oldStatus && newAssignee && newAssignee !== actor) {
      await createNotification({
        user_id: newAssignee,
        event_type: 'status_change',
        title: `Status: ${(data as any).title}`,
        body: `Moved to ${newStatus.replace(/_/g, ' ')}`,
        link,
      });
    }
  } catch {}
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
  // Inherit client:/type: tags from the parent project so tasks are searchable by
  // client and project shape without manual entry.
  if (payload.project_id) {
    try {
      const { mergeInheritedTags } = await import('./tags');
      const { data: proj } = await supabase
        .from('pm_projects')
        .select('tags')
        .eq('id', payload.project_id)
        .maybeSingle();
      const projTags = ((proj as any)?.tags ?? []) as string[];
      payload.tags = mergeInheritedTags(payload.tags ?? [], projTags);
    } catch {}
  }
  const { data, error } = await supabase.from('pm_tasks').insert(payload).select().single();
  if (error) throw error;
  emitTasksChanged();
  try {
    const { createNotification } = await import('./notifications');
    const link = `/pm/tasks/${(data as any).id}`;
    const assignee = (data as any).assignee_id as string | null;
    if (assignee && assignee !== uid) {
      await createNotification({
        user_id: assignee,
        event_type: 'assigned',
        title: `Assigned: ${(data as any).title}`,
        body: 'You were assigned to a task',
        link,
      });
    }
    // Notify PM/CSM on new unclaimed request-type tasks
    if ((data as any).status === 'unclaimed') {
      // Multi-role aware: notify anyone holding pm/csm in any of their roles.
      const { data: allUsers } = await supabase.from('mock_users').select('id, role, secondary_role, roles');
      const pms = ((allUsers ?? []) as any[]).filter(u => {
        const r: string[] = Array.isArray(u.roles) && u.roles.length
          ? u.roles
          : [u.role, u.secondary_role].filter(Boolean);
        return r.includes('pm') || r.includes('csm');
      });
      const notified = new Set<string>();
      for (const u of (pms ?? []) as any[]) {
        if (u.id === uid) continue;
        notified.add(u.id);
        await createNotification({
          user_id: u.id,
          event_type: 'new_request',
          title: `New request: ${(data as any).title}`,
          link,
        });
      }

      // Notify the task's team(s) that unclaimed work landed in their queue.
      const {
        teamsFromTask, DEFAULT_TEAMS_FOR_TYPE, ROLE_TO_TEAM, TEAM_PEERS,
        USER_TEAM_OVERRIDES, TEAM_LABEL,
      } = await import('./teams');
      let taskTeams = teamsFromTask(data as any);
      if (!taskTeams.length) {
        taskTeams = DEFAULT_TEAMS_FOR_TYPE[(data as any).type as keyof typeof DEFAULT_TEAMS_FOR_TYPE] ?? [];
      }
      if (taskTeams.length) {
        const wanted = new Set(taskTeams);
        for (const u of ((allUsers ?? []) as any[])) {
          if (u.id === uid || u.id === assignee || notified.has(u.id)) continue;
          const roles: string[] = Array.isArray(u.roles) && u.roles.length
            ? u.roles
            : [u.role, u.secondary_role].filter(Boolean);
          const mine = new Set<string>();
          for (const r of roles) {
            const t = ROLE_TO_TEAM[r as keyof typeof ROLE_TO_TEAM];
            if (!t) continue;
            mine.add(t);
            for (const p of TEAM_PEERS[t] ?? []) mine.add(p);
          }
          for (const p of USER_TEAM_OVERRIDES[u.id]?.peers ?? []) mine.add(p);
          const hit = taskTeams.find(t => mine.has(t)) ?? [...mine].find(t => wanted.has(t as any));
          if (!hit) continue;
          notified.add(u.id);
          await createNotification({
            user_id: u.id,
            event_type: 'unclaimed_team',
            title: `Unclaimed ${TEAM_LABEL[hit as keyof typeof TEAM_LABEL]} task: ${(data as any).title}`,
            link,
          });
        }
      }
    }
  } catch {}
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

export const deleteProject = async (id: string) => {
  const sb: any = supabase;
  // pm_tasks and most related tables cascade on project_id; clear siblings that may not.
  await sb.from('pm_project_attachments').delete().eq('project_id', id);
  await sb.from('pm_project_links').delete().eq('project_id', id);
  await sb.from('pm_notes').delete().eq('project_id', id);
  const { error } = await sb.from('pm_projects').delete().eq('id', id);
  if (error) throw error;
  emitTasksChanged();
};

export const createProject = async (p: Partial<PmProject> & { requested_by?: string | null }) => {
  const uid = getCurrentUserId();
  const payload: any = { ...p };
  if (uid && payload.created_by === undefined) payload.created_by = uid;
  // Auto-apply client:<slug> tag from the linked client so filtering by client works everywhere.
  if (payload.client_id) {
    try {
      const { clientTag } = await import('./tags');
      const { data: c } = await supabase.from('clients').select('name').eq('id', payload.client_id).maybeSingle();
      const ct = clientTag((c as any)?.name);
      if (ct) {
        const existing = (payload.tags ?? []) as string[];
        if (!existing.includes(ct)) payload.tags = [...existing, ct];
      }
    } catch {}
  }
  const { data, error } = await supabase.from('pm_projects').insert(payload).select().single();
  if (error) throw error;
  const projectId = (data as any)?.id;
  // Ensure creator is a project member so they're "assigned" to the project.
  if (uid && projectId) {
    await supabase.from('pm_project_members').insert({
      project_id: projectId, user_id: uid, role: 'creator',
    } as any);
  }
  // Add requester as a member too, so the project surfaces in their Briefing.
  const reqId = (payload.requested_by ?? null) as string | null;
  if (reqId && projectId && reqId !== uid) {
    await supabase.from('pm_project_members').insert({
      project_id: projectId, user_id: reqId, role: 'requester',
    } as any);
  }
  return data as unknown as PmProject;
};

const ATT_BUCKET = 'task-attachments';

/** Upload staged files + insert staged links after a project/task is created. */
export async function persistIntakeAttachments(opts: {
  projectId: string;
  taskId?: string | null;
  files: File[];
  links: { url: string; label: string }[];
  userId?: string | null;
}) {
  const { projectId, taskId, files, links, userId } = opts;

  // Files: prefer task-scoped attachment row when a task exists, otherwise project-level.
  for (const f of files) {
    const folder = taskId ? `task/${taskId}` : `project/${projectId}`;
    const path = `${folder}/${crypto.randomUUID()}-${f.name}`;
    const { error: upErr } = await supabase.storage.from(ATT_BUCKET).upload(path, f);
    if (upErr) { console.error('upload failed', upErr); continue; }
    const { data: pub } = supabase.storage.from(ATT_BUCKET).getPublicUrl(path);

    if (taskId) {
      await supabase.from('pm_attachments').insert({
        task_id: taskId, project_id: projectId, type: 'file',
        name: f.name, url: pub.publicUrl, file_size: f.size,
        uploaded_by: userId ?? null,
      } as any);
    } else {
      await supabase.from('pm_project_attachments').insert({
        project_id: projectId, type: 'file',
        name: f.name, url: pub.publicUrl, file_size: f.size,
        uploaded_by: userId ?? null,
      } as any);
    }
  }

  // Links: task-scoped if task exists, else project-level.
  if (links.length) {
    if (taskId) {
      await supabase.from('pm_task_links').insert(
        links.map(l => ({
          task_id: taskId, url: l.url, label: l.label || null,
          created_by: userId ?? null,
        })) as any
      );
    } else {
      await supabase.from('pm_project_links' as any).insert(
        links.map(l => ({
          project_id: projectId, url: l.url, label: l.label || null,
          created_by: userId ?? null,
        })) as any
      );
    }
  }
}

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
  template_task_id?: string;
  phase_name: string | null;
  type: string;
  assignee_role: string | null;
  sort_order: number;
  page_group_key?: string | null;
  page_label?: string | null;
  teams?: string[];
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
    template_task_id: t.id,
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
    page_group_key: t._page_group_key ?? null,
    page_label: t._page_label ?? null,
    teams: Array.isArray(t.teams) ? t.teams : undefined,
  }));
  const previewDeps: (ScheduleDep & { reveal_mode?: string })[] = deps.map(d => ({
    task_id: d.to_temp_id,
    depends_on_task_id: d.from_temp_id,
    type: d.type,
    lag_days: d.lag_days || 0,
    reveal_mode: d.reveal_mode ?? 'on_complete',
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
  const fmt = (d: Date) => localDateISO(d);

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
      page_label: pt.page_label ?? null,
      page_group_key: pt.page_group_key ?? null,
      teams: Array.isArray(pt.teams) && pt.teams.length ? pt.teams : undefined,
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
    .map((d: any) => ({
      task_id: idByTemp.get(d.task_id),
      depends_on_task_id: idByTemp.get(d.depends_on_task_id),
      type: d.type,
      lag_days: d.lag_days || 0,
      reveal_mode: d.reveal_mode ?? 'on_complete',
    }))
    .filter(d => d.task_id && d.depends_on_task_id);
  if (depRows.length) await supabase.from('pm_task_dependencies').insert(depRows as any);

  // Snippet links — copy template_task_snippets to live task_snippets
  const tempTaskIds = previewTasks
    .map(p => p.template_task_id)
    .filter((x): x is string => !!x);
  if (tempTaskIds.length) {
    const { data: snipLinks } = await supabase
      .from('pm_template_task_snippets')
      .select('template_task_id, snippet_id')
      .in('template_task_id', tempTaskIds);
    const realIdByTempTaskId = new Map<string, string>();
    for (const pt of previewTasks) {
      const realId = idByTemp.get(pt.temp_id);
      if (pt.template_task_id && realId) realIdByTempTaskId.set(pt.template_task_id, realId);
    }
    const uid = getCurrentUserId();
    const snippetRows = (snipLinks ?? [])
      .map((l: any) => ({
        task_id: realIdByTempTaskId.get(l.template_task_id),
        snippet_id: l.snippet_id,
        linked_by: uid ?? null,
      }))
      .filter(r => r.task_id);
    if (snippetRows.length) {
      await supabase.from('pm_task_snippets').insert(snippetRows as any);
    }
  }

  return { idByTemp };
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

  const { idByTemp } = await instantiateTemplateIntoProject({
    projectId: (proj as any).id,
    previewTasks, previewDeps, placement,
  });

  await stampDiscoveryLinks({ templateId: template.id, idByTemp });

  emitTasksChanged();
  return proj as unknown as PmProject;
};

/**
 * For each page group with a `discovery_task_temp_id`, tag the live task's
 * custom_fields.discovery_for_group_ids so we can detect completion later.
 */
async function stampDiscoveryLinks(params: {
  templateId: string;
  idByTemp: Map<string, string>;
}) {
  const { templateId, idByTemp } = params;
  const { data: groups } = await supabase
    .from('pm_template_page_groups')
    .select('id, discovery_task_temp_id')
    .eq('template_id', templateId);
  if (!groups?.length) return;

  // taskId → groupIds[]
  const byTaskId = new Map<string, string[]>();
  for (const g of groups as any[]) {
    if (!g.discovery_task_temp_id) continue;
    const taskId = idByTemp.get(g.discovery_task_temp_id);
    if (!taskId) continue;
    if (!byTaskId.has(taskId)) byTaskId.set(taskId, []);
    byTaskId.get(taskId)!.push(g.id);
  }
  if (!byTaskId.size) return;

  // fetch current custom_fields to merge
  const { data: rows } = await supabase
    .from('pm_tasks')
    .select('id, custom_fields')
    .in('id', Array.from(byTaskId.keys()));
  for (const r of (rows || []) as any[]) {
    const cf = r.custom_fields || {};
    const existing: string[] = Array.isArray(cf.discovery_for_group_ids) ? cf.discovery_for_group_ids : [];
    const merged = Array.from(new Set([...existing, ...(byTaskId.get(r.id) || [])]));
    await supabase.from('pm_tasks').update({
      custom_fields: { ...cf, discovery_for_group_ids: merged },
    } as any).eq('id', r.id);
  }
}

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

  const { idByTemp } = await instantiateTemplateIntoProject({
    projectId, previewTasks, previewDeps, placement,
    sortOffset: 1000, // existing request tasks keep their sort order at top
  });
  await stampDiscoveryLinks({ templateId: template.id, idByTemp });

  emitTasksChanged();
};

/** Apply scheduler diffs to live tasks. */
export const applyScheduleDiffs = async (diffs: DateDiff[]) => {
  for (const d of diffs) {
    await supabase.from('pm_tasks').update({ start_date: d.newStart, due_date: d.newEnd } as any).eq('id', d.taskId);
  }
  emitTasksChanged();
};

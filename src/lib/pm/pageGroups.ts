import { supabase } from '@/integrations/supabase/client';
import { isDone } from '@/types/pm';
import type { TaskStatus } from '@/types/pm';

export interface PageGroup {
  id: string;
  template_id: string;
  name: string;
  phase_name: string | null;
  sort_order: number;
  parallel: boolean;
  expected_page_count?: number;
  parallel_cap?: number;
  reserved_by_phase?: Record<string, number>; // override map: { phaseName: days }
  discovery_task_temp_id?: string | null;
  allow_late_definition?: boolean;
}

export interface PagePreset {
  id: string;
  template_id: string;
  page_group_id: string | null;
  name: string;
  is_default: boolean;
  sort_order: number;
}

export interface SelectedPage {
  key: string;
  page_group_id: string;
  page_label: string;
}

export const RESERVED_PREFIX = 'reserved:';

export const fetchPageGroups = async (templateId: string): Promise<PageGroup[]> => {
  const { data } = await supabase
    .from('pm_template_page_groups')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');
  return (data || []) as any;
};

export const fetchPagePresets = async (templateId: string): Promise<PagePreset[]> => {
  const { data } = await supabase
    .from('pm_template_page_presets')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');
  return (data || []) as any;
};

/**
 * Compute default per-phase reservation days for a group:
 *   for each phase that has slot tasks, days = ceil(sum(slot_duration) * expected_count / parallel_cap)
 * Honors override in `group.reserved_by_phase` per phase when set (> 0).
 */
export function computeReservedByPhase(
  group: PageGroup,
  slotTasks: { phase_name: string | null; duration_days: number }[],
): Record<string, number> {
  const expected = Math.max(1, group.expected_page_count ?? 5);
  const cap = Math.max(1, group.parallel_cap ?? 3);
  const override = group.reserved_by_phase || {};
  const byPhase: Record<string, number> = {};
  for (const s of slotTasks) {
    const ph = s.phase_name || 'Other';
    byPhase[ph] = (byPhase[ph] || 0) + (s.duration_days || 0);
  }
  const out: Record<string, number> = {};
  for (const ph of Object.keys(byPhase)) {
    const o = override[ph];
    out[ph] = o && o > 0 ? o : Math.max(1, Math.ceil((byPhase[ph] * expected) / cap));
  }
  return out;
}

/**
 * Expand template tasks. For each page group:
 *  - If selectedPages has entries for that group → duplicate slots per page (original behavior).
 *  - Else → emit ONE reservation placeholder per phase that has slot tasks for that group.
 *    Cross-group deps wire to the reservation task in the correct phase.
 */
export function expandPageGroupsInTemplate(params: {
  templateTasks: any[];
  templateDeps: any[];
  selectedPages: SelectedPage[];
  groups?: PageGroup[];
}) {
  const { templateTasks, templateDeps, selectedPages, groups = [] } = params;
  const groupById = new Map(groups.map(g => [g.id, g]));

  const pagesByGroup = new Map<string, SelectedPage[]>();
  for (const p of selectedPages) {
    if (!pagesByGroup.has(p.page_group_id)) pagesByGroup.set(p.page_group_id, []);
    pagesByGroup.get(p.page_group_id)!.push(p);
  }

  const outTasks: any[] = [];
  // temp_id → list of expanded { temp_id, page_key, page_label }
  const expansion = new Map<string, { temp_id: string; page_key: string | null; page_label: string | null }[]>();

  // Pre-create reservation tasks per group/phase for groups without selected pages
  // Map: groupId → phase → reservation temp_id
  const resTempByGroupPhase = new Map<string, Map<string, string>>();
  let sortCounter = 0;

  // First pass — non-group tasks AND record group slots for later
  const groupSlotsByGroup = new Map<string, any[]>();
  for (const t of templateTasks) {
    if (!t.page_group_id) {
      outTasks.push({ ...t, _page_group_key: null, _page_label: null, sort_order: sortCounter++ });
      expansion.set(t.temp_id, [{ temp_id: t.temp_id, page_key: null, page_label: null }]);
    } else {
      if (!groupSlotsByGroup.has(t.page_group_id)) groupSlotsByGroup.set(t.page_group_id, []);
      groupSlotsByGroup.get(t.page_group_id)!.push(t);
    }
  }

  // Second pass — for each group, either expand per page OR emit reservation tasks
  for (const [groupId, slots] of groupSlotsByGroup) {
    const pages = pagesByGroup.get(groupId) || [];
    const group = groupById.get(groupId);

    if (pages.length > 0) {
      // Existing behavior: stamp per page
      for (const t of slots) {
        const fanout: { temp_id: string; page_key: string; page_label: string }[] = [];
        for (const page of pages) {
          const newTempId = `${t.temp_id}__${page.key}`;
          fanout.push({ temp_id: newTempId, page_key: page.key, page_label: page.page_label });
          outTasks.push({
            ...t,
            temp_id: newTempId,
            title: `${page.page_label} — ${t.title}`,
            _page_group_key: page.key,
            _page_label: page.page_label,
            sort_order: sortCounter++,
          });
        }
        expansion.set(t.temp_id, fanout);
      }
    } else if (group) {
      // Reservation mode: one placeholder per phase
      const reserved = computeReservedByPhase(group, slots.map(s => ({ phase_name: s.phase_name, duration_days: s.duration_days })));
      const phaseToRes = new Map<string, string>();
      for (const phase of Object.keys(reserved)) {
        const resTempId = `${RESERVED_PREFIX}${groupId}:${phase}`;
        phaseToRes.set(phase, resTempId);
        // pick a representative slot for type/etc
        const rep = slots.find(s => (s.phase_name || 'Other') === phase) || slots[0];
        outTasks.push({
          ...rep,
          temp_id: resTempId,
          title: `${group.name} pages — reserved (${phase})`,
          phase_name: rep.phase_name,
          duration_days: reserved[phase],
          min_duration_days: 1,
          locked: false,
          page_group_id: groupId,
          _page_group_key: `${RESERVED_PREFIX}${groupId}`,
          _page_label: `[Reserved] ${group.name}`,
          _reserved: true,
          _reserved_phase: phase,
          _reserved_group_id: groupId,
          sort_order: sortCounter++,
        });
      }
      resTempByGroupPhase.set(groupId, phaseToRes);
      // Map every slot temp_id to its reservation task in the matching phase
      for (const t of slots) {
        const ph = t.phase_name || 'Other';
        const resId = phaseToRes.get(ph);
        if (resId) expansion.set(t.temp_id, [{ temp_id: resId, page_key: null, page_label: null }]);
        else expansion.set(t.temp_id, []);
      }
    } else {
      // Group missing (orphan slots) — drop
      for (const t of slots) expansion.set(t.temp_id, []);
    }
  }

  // Rewrite deps
  const outDeps: any[] = [];
  const seen = new Set<string>();
  for (const d of templateDeps) {
    const fromList = expansion.get(d.from_temp_id) || [];
    const toList = expansion.get(d.to_temp_id) || [];
    for (const from of fromList) {
      for (const to of toList) {
        if (from.temp_id === to.temp_id) continue;
        if (from.page_key && to.page_key && from.page_key !== to.page_key) continue;
        const sig = `${from.temp_id}->${to.temp_id}:${d.type}:${d.lag_days || 0}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        outDeps.push({ ...d, from_temp_id: from.temp_id, to_temp_id: to.temp_id });
      }
    }
  }

  return { tasks: outTasks, deps: outDeps };
}

/**
 * Add a page to a project mid-flight. Stamps per-slot tasks, copies intra-group deps,
 * AND shrinks any active reservation placeholders for that group/phase by the new page's
 * per-phase duration / parallel_cap (clamped to 0). When a reservation drops to 0, it stays
 * as a 0-day marker so deps remain valid.
 */
/** The single "Define pages" task for a project (BA-owned), if one exists. */
export const getDefinePagesTask = async (projectId: string) => {
  const { data } = await supabase
    .from('pm_tasks')
    .select('id, title, status, assignee_id, due_date, custom_fields')
    .eq('project_id', projectId);
  return ((data || []) as any[]).find(t => t.custom_fields?.define_pages === true) || null;
};

/** How many real (non-reserved) pages have been defined on a project. */
export const definedPageCount = async (projectId: string) => {
  const { data } = await supabase
    .from('pm_tasks')
    .select('page_group_key')
    .eq('project_id', projectId)
    .not('page_group_key', 'is', null);
  const keys = new Set(
    ((data || []) as any[])
      .map(r => r.page_group_key as string)
      .filter(k => k && !k.startsWith(RESERVED_PREFIX)),
  );
  return keys.size;
};

export const addPageToProject = async (params: {
  projectId: string;
  templateId: string;
  pageGroupId: string;
  pageLabel: string;
}): Promise<{ insertedCount: number }> => {
  const { projectId, templateId, pageGroupId, pageLabel } = params;


  const [{ data: slots }, { data: deps }, { data: phases }, { data: groupRow }] = await Promise.all([
    supabase.from('pm_template_tasks').select('*').eq('template_id', templateId).eq('page_group_id', pageGroupId).order('sort_order'),
    supabase.from('pm_template_dependencies').select('*').eq('template_id', templateId),
    supabase.from('pm_project_phases').select('*').eq('project_id', projectId),
    supabase.from('pm_template_page_groups').select('*').eq('id', pageGroupId).maybeSingle(),
  ]);

  if (!slots || !slots.length) return { insertedCount: 0 };
  const group = groupRow as any as PageGroup | null;
  const cap = Math.max(1, group?.parallel_cap ?? 3);

  const pageKey = `${pageGroupId.slice(0, 6)}_${Date.now().toString(36)}`;
  const phaseIdByName = new Map<string, string>();
  for (const p of phases || []) phaseIdByName.set((p as any).name, (p as any).id);

  const { data: maxSort } = await supabase.from('pm_tasks').select('sort_order').eq('project_id', projectId).order('sort_order', { ascending: false }).limit(1);
  let nextSort = (maxSort?.[0]?.sort_order ?? 0) + 10;

  const tempToReal = new Map<string, string>();
  // Sum new-page duration per phase
  const addedByPhase: Record<string, number> = {};
  for (const s of slots as any[]) {
    const phName = s.phase_name || 'Other';
    addedByPhase[phName] = (addedByPhase[phName] || 0) + (s.duration_days || 0);
    const { data: inserted } = await supabase.from('pm_tasks').insert({
      project_id: projectId,
      phase_id: s.phase_name ? phaseIdByName.get(s.phase_name) ?? null : null,
      title: `${pageLabel} — ${s.title}`,
      type: s.type,
      status: 'unclaimed',
      priority: 'medium',
      duration_days: s.duration_days,
      min_duration_days: s.min_duration_days,
      locked: !!s.locked,
      sort_order: nextSort++,
      page_label: pageLabel,
      page_group_key: pageKey,
      teams: Array.isArray(s.teams) && s.teams.length ? s.teams : undefined,
    } as any).select().single();
    if (inserted) tempToReal.set(s.temp_id, (inserted as any).id);
  }

  // Intra-group deps
  const slotTempIds = new Set((slots as any[]).map(s => s.temp_id));
  const intra = (deps || []).filter((d: any) => slotTempIds.has(d.from_temp_id) && slotTempIds.has(d.to_temp_id));
  const depRows = intra
    .map((d: any) => ({
      task_id: tempToReal.get(d.to_temp_id),
      depends_on_task_id: tempToReal.get(d.from_temp_id),
      type: d.type,
      lag_days: d.lag_days || 0,
    }))
    .filter(r => r.task_id && r.depends_on_task_id);
  if (depRows.length) await supabase.from('pm_task_dependencies').insert(depRows as any);

  // Shrink reservation placeholders for this group, per phase
  const reservedKey = `${RESERVED_PREFIX}${pageGroupId}`;
  const { data: resTasks } = await supabase
    .from('pm_tasks').select('id, duration_days, phase_id, title')
    .eq('project_id', projectId).eq('page_group_key', reservedKey);
  for (const r of resTasks || []) {
    // Find the phase name for this reservation task
    const phaseRow = (phases || []).find((p: any) => p.id === (r as any).phase_id) as any;
    const phName = phaseRow?.name || 'Other';
    const consumed = Math.ceil((addedByPhase[phName] || 0) / cap);
    if (!consumed) continue;
    const newDur = Math.max(0, ((r as any).duration_days || 0) - consumed);
    await supabase.from('pm_tasks').update({ duration_days: newDur } as any).eq('id', (r as any).id);
  }

  return { insertedCount: slots.length };
};

export const removePageFromProject = async (projectId: string, pageGroupKey: string) => {
  await supabase.from('pm_tasks').delete().eq('project_id', projectId).eq('page_group_key', pageGroupKey);
};

/** Fetch live reservation tasks + their page group for a project. */
export const fetchProjectReservations = async (projectId: string) => {
  const { data } = await supabase
    .from('pm_tasks').select('*')
    .eq('project_id', projectId)
    .like('page_group_key', `${RESERVED_PREFIX}%`);
  return (data || []) as any[];
};

/**
 * Returns page groups awaiting page definition — where the group's discovery task
 * has been completed but no real pages have been stamped yet.
 * Includes a fallback for legacy projects where the discovery link wasn't stamped:
 * matches by template_task.temp_id → title → live task.
 */
export interface AwaitingGroup {
  group: PageGroup;
  discoveryTaskId: string | null;
  hasReservations: boolean;
  definedCount: number;
}

const isDiscoveryDone = (status?: string | null) => isDone(status as TaskStatus);

export const getGroupsAwaitingPages = async (
  projectId: string,
  templateId: string | null,
  tasks: { id: string; status?: string | null; title?: string; page_group_key?: string | null; custom_fields?: any }[],
): Promise<AwaitingGroup[]> => {
  if (!templateId) return [];
  const groups = await fetchPageGroups(templateId);
  const eligible = groups.filter(g => !!g.discovery_task_temp_id);
  if (!eligible.length) return [];

  // Fallback map: temp_id -> title (for legacy projects without stamped link)
  const tempIds = eligible.map(g => g.discovery_task_temp_id!).filter(Boolean);
  const { data: tmplTasks } = await supabase
    .from('pm_template_tasks')
    .select('temp_id, title')
    .eq('template_id', templateId)
    .in('temp_id', tempIds as string[]);
  const titleByTempId = new Map<string, string>();
  for (const r of (tmplTasks || []) as any[]) titleByTempId.set(r.temp_id, r.title);

  const out: AwaitingGroup[] = [];
  for (const g of eligible) {
    const tempId = g.discovery_task_temp_id!;
    // Prefer stamped custom_fields link
    let discoveryTask = tasks.find(t => {
      const ids = (t as any).custom_fields?.discovery_for_group_ids;
      return Array.isArray(ids) && ids.includes(g.id);
    });
    if (!discoveryTask) {
      const title = titleByTempId.get(tempId);
      if (title) discoveryTask = tasks.find(t => t.title === title);
    }
    if (!discoveryTask) continue;
    if (!isDiscoveryDone(discoveryTask.status)) continue;

    // Real pages stamped for this group? Best-effort key prefix match (see PagesTab logic).
    const groupPrefix = g.id.slice(0, 6);
    const definedCount = new Set(
      tasks
        .filter(t => {
          const k = (t as any).page_group_key as string | null | undefined;
          return k && !k.startsWith(RESERVED_PREFIX) && k.startsWith(groupPrefix);
        })
        .map(t => (t as any).page_group_key as string),
    ).size;
    if (definedCount > 0) continue;

    // Only surface if there are still reservations OR no pages at all
    const hasReservations = tasks.some(
      t => (t as any).page_group_key === `${RESERVED_PREFIX}${g.id}`,
    );

    out.push({ group: g, discoveryTaskId: discoveryTask.id, hasReservations, definedCount });
  }
  return out;
};

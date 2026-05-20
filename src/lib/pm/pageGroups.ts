import { supabase } from '@/integrations/supabase/client';
import type { ScheduleDep } from '@/lib/pm/scheduler';

export interface PageGroup {
  id: string;
  template_id: string;
  name: string;
  phase_name: string | null;
  sort_order: number;
  parallel: boolean;
}

export interface PagePreset {
  id: string;
  template_id: string;
  page_group_id: string | null;
  name: string;
  is_default: boolean;
  sort_order: number;
}

/** A page the PM chose to include in this project. */
export interface SelectedPage {
  key: string;            // unique key for this page instance (stable per pick)
  page_group_id: string;
  page_label: string;     // e.g. "Benefits"
}

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
 * Expand a flat list of template tasks (some marked as group slots) into per-page copies.
 * - Tasks with no page_group_id are kept as-is.
 * - Tasks with page_group_id are duplicated once per selected page in that group.
 * - Intra-group dependencies are rewritten per page.
 * - Cross dependencies (slot → fixed or fixed → slot) fan out: every page copy inherits them.
 */
export function expandPageGroupsInTemplate(params: {
  templateTasks: any[];                        // pm_template_tasks rows
  templateDeps: any[];                         // pm_template_dependencies rows
  selectedPages: SelectedPage[];
}) {
  const { templateTasks, templateDeps, selectedPages } = params;

  const pagesByGroup = new Map<string, SelectedPage[]>();
  for (const p of selectedPages) {
    if (!pagesByGroup.has(p.page_group_id)) pagesByGroup.set(p.page_group_id, []);
    pagesByGroup.get(p.page_group_id)!.push(p);
  }

  const outTasks: any[] = [];
  // Map: original temp_id -> array of { temp_id, page_key, page_label }
  // For non-group tasks, array has one entry with the original.
  const expansion = new Map<string, { temp_id: string; page_key: string | null; page_label: string | null }[]>();

  let sortCounter = 0;
  for (const t of templateTasks) {
    if (!t.page_group_id) {
      const copy = { ...t, _page_group_key: null, _page_label: null, sort_order: sortCounter++ };
      outTasks.push(copy);
      expansion.set(t.temp_id, [{ temp_id: t.temp_id, page_key: null, page_label: null }]);
      continue;
    }
    const pages = pagesByGroup.get(t.page_group_id) || [];
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

  // Rewrite deps
  const outDeps: any[] = [];
  for (const d of templateDeps) {
    const fromList = expansion.get(d.from_temp_id) || [];
    const toList = expansion.get(d.to_temp_id) || [];
    for (const from of fromList) {
      for (const to of toList) {
        // If both are page slots of the same group → only link within same page instance
        if (from.page_key && to.page_key && from.page_key !== to.page_key) continue;
        outDeps.push({ ...d, from_temp_id: from.temp_id, to_temp_id: to.temp_id });
      }
    }
  }

  return { tasks: outTasks, deps: outDeps };
}

/**
 * Mid-project: add a single page to a project that was created from a template.
 * Inserts new tasks (with page_label + page_group_key) and intra-group deps.
 */
export const addPageToProject = async (params: {
  projectId: string;
  templateId: string;
  pageGroupId: string;
  pageLabel: string;
}): Promise<{ insertedCount: number }> => {
  const { projectId, templateId, pageGroupId, pageLabel } = params;

  const [{ data: slots }, { data: deps }, { data: phases }] = await Promise.all([
    supabase.from('pm_template_tasks').select('*').eq('template_id', templateId).eq('page_group_id', pageGroupId).order('sort_order'),
    supabase.from('pm_template_dependencies').select('*').eq('template_id', templateId),
    supabase.from('pm_project_phases').select('*').eq('project_id', projectId),
  ]);

  if (!slots || !slots.length) return { insertedCount: 0 };

  const pageKey = `${pageGroupId.slice(0, 6)}_${Date.now().toString(36)}`;
  const phaseIdByName = new Map<string, string>();
  for (const p of phases || []) phaseIdByName.set((p as any).name, (p as any).id);

  // Compute starting sort_order
  const { data: maxSort } = await supabase.from('pm_tasks').select('sort_order').eq('project_id', projectId).order('sort_order', { ascending: false }).limit(1);
  let nextSort = (maxSort?.[0]?.sort_order ?? 0) + 10;

  const tempToReal = new Map<string, string>();
  for (const s of slots) {
    const { data: inserted } = await supabase.from('pm_tasks').insert({
      project_id: projectId,
      phase_id: (s as any).phase_name ? phaseIdByName.get((s as any).phase_name) ?? null : null,
      title: `${pageLabel} — ${(s as any).title}`,
      type: (s as any).type,
      status: 'unclaimed',
      priority: 'medium',
      duration_days: (s as any).duration_days,
      min_duration_days: (s as any).min_duration_days,
      locked: !!(s as any).locked,
      sort_order: nextSort++,
      page_label: pageLabel,
      page_group_key: pageKey,
    } as any).select().single();
    if (inserted) tempToReal.set((s as any).temp_id, (inserted as any).id);
  }

  // Intra-group deps only
  const slotTempIds = new Set(slots.map((s: any) => s.temp_id));
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

  return { insertedCount: slots.length };
};

/** Delete every task tied to a page_group_key for a project. */
export const removePageFromProject = async (projectId: string, pageGroupKey: string) => {
  await supabase.from('pm_tasks').delete().eq('project_id', projectId).eq('page_group_key', pageGroupKey);
};

import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import type { Snippet } from "@/lib/pm/snippets";

export type LinkedTaskSnippet = {
  id: string;
  task_id: string;
  snippet_id: string;
  linked_by: string | null;
  linked_at: string;
  snippet: Snippet;
};

export async function fetchTaskSnippetIds(taskId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("pm_task_snippets")
    .select("snippet_id")
    .eq("task_id", taskId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.snippet_id);
}

export async function fetchTaskSnippets(taskId: string): Promise<LinkedTaskSnippet[]> {
  const { data, error } = await supabase
    .from("pm_task_snippets")
    .select("*, snippet:pm_snippets(*, variations:pm_snippet_variations(*))")
    .eq("task_id", taskId)
    .order("linked_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    snippet: r.snippet
      ? {
          ...r.snippet,
          tags: r.snippet.tags ?? [],
          project_ids: r.snippet.project_ids ?? [],
          variations: (r.snippet.variations ?? []).sort(
            (a: any, b: any) => a.sort_order - b.sort_order,
          ),
        }
      : null,
  })) as LinkedTaskSnippet[];
}

export async function linkSnippetToTask(taskId: string, snippetId: string) {
  const { error } = await supabase
    .from("pm_task_snippets")
    .insert({ task_id: taskId, snippet_id: snippetId, linked_by: getCurrentUserId() });
  if (error && !`${error.message}`.includes("duplicate")) throw error;
}

export async function unlinkSnippetFromTask(taskId: string, snippetId: string) {
  const { error } = await supabase
    .from("pm_task_snippets")
    .delete()
    .eq("task_id", taskId)
    .eq("snippet_id", snippetId);
  if (error) throw error;
}

// ----- Template-task version -----

export async function fetchTemplateTaskSnippetIds(templateTaskId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("pm_template_task_snippets")
    .select("snippet_id")
    .eq("template_task_id", templateTaskId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.snippet_id);
}

export async function fetchTemplateSnippetCounts(
  templateTaskIds: string[],
): Promise<Record<string, number>> {
  if (!templateTaskIds.length) return {};
  const { data, error } = await supabase
    .from("pm_template_task_snippets")
    .select("template_task_id")
    .in("template_task_id", templateTaskIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = (r as any).template_task_id as string;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export async function linkSnippetToTemplateTask(templateTaskId: string, snippetId: string) {
  const { error } = await supabase
    .from("pm_template_task_snippets")
    .insert({ template_task_id: templateTaskId, snippet_id: snippetId });
  if (error && !`${error.message}`.includes("duplicate")) throw error;
}

export async function unlinkSnippetFromTemplateTask(templateTaskId: string, snippetId: string) {
  const { error } = await supabase
    .from("pm_template_task_snippets")
    .delete()
    .eq("template_task_id", templateTaskId)
    .eq("snippet_id", snippetId);
  if (error) throw error;
}

export type TemplateSnippetSummaryRow = {
  snippet_id: string;
  title: string;
  category_name: string | null;
  category_color: string | null;
  used_in_tasks: number;
};

export async function fetchTemplateSnippetSummary(
  templateTaskIds: string[],
): Promise<TemplateSnippetSummaryRow[]> {
  if (!templateTaskIds.length) return [];
  const { data, error } = await supabase
    .from("pm_template_task_snippets")
    .select("snippet_id, snippet:pm_snippets(id, title, category:pm_snippet_categories(name, color))")
    .in("template_task_id", templateTaskIds);
  if (error) throw error;
  const byId = new Map<string, TemplateSnippetSummaryRow>();
  for (const r of data ?? []) {
    const sid = (r as any).snippet_id as string;
    const s = (r as any).snippet;
    if (!s) continue;
    const existing = byId.get(sid);
    if (existing) existing.used_in_tasks += 1;
    else
      byId.set(sid, {
        snippet_id: sid,
        title: s.title,
        category_name: s.category?.name ?? null,
        category_color: s.category?.color ?? null,
        used_in_tasks: 1,
      });
  }
  return Array.from(byId.values()).sort((a, b) => b.used_in_tasks - a.used_in_tasks);
}

import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pm/mockUser";

export type SnippetCategory = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type SnippetVariation = {
  id: string;
  snippet_id: string;
  name: string;
  code: string;
  sort_order: number;
};

export type Snippet = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  video_url: string | null;
  category_id: string | null;
  language: string | null;
  tags: string[];
  project_ids: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  variations: SnippetVariation[];
};

export type SnippetInput = {
  title: string;
  description?: string | null;
  instructions?: string | null;
  video_url?: string | null;
  category_id?: string | null;
  language?: string | null;
  tags: string[];
  project_ids: string[];
  variations: { name: string; code: string }[];
};

export async function fetchCategories(): Promise<SnippetCategory[]> {
  const { data, error } = await supabase
    .from("pm_snippet_categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as SnippetCategory[];
}

export async function createCategory(name: string, color?: string | null) {
  const { data, error } = await supabase
    .from("pm_snippet_categories")
    .insert({ name, color: color ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as SnippetCategory;
}

export async function renameCategory(id: string, name: string) {
  const { error } = await supabase
    .from("pm_snippet_categories")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("pm_snippet_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSnippets(): Promise<Snippet[]> {
  const { data, error } = await supabase
    .from("pm_snippets")
    .select("*, variations:pm_snippet_variations(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    ...s,
    tags: s.tags ?? [],
    project_ids: s.project_ids ?? [],
    variations: ((s.variations ?? []) as SnippetVariation[]).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  })) as Snippet[];
}

async function replaceVariations(
  snippetId: string,
  variations: { name: string; code: string }[],
) {
  await supabase.from("pm_snippet_variations").delete().eq("snippet_id", snippetId);
  const rows = variations.map((v, i) => ({
    snippet_id: snippetId,
    name: v.name || "Default",
    code: v.code ?? "",
    sort_order: i,
  }));
  if (rows.length) {
    const { error } = await supabase.from("pm_snippet_variations").insert(rows);
    if (error) throw error;
  }
}

export async function createSnippet(input: SnippetInput): Promise<Snippet> {
  const { data, error } = await supabase
    .from("pm_snippets")
    .insert({
      title: input.title,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      video_url: input.video_url ?? null,
      category_id: input.category_id ?? null,
      language: input.language ?? null,
      tags: input.tags,
      project_ids: input.project_ids,
      created_by: getCurrentUserId(),
    })
    .select()
    .single();
  if (error) throw error;
  await replaceVariations(data.id, input.variations.length ? input.variations : [{ name: "Default", code: "" }]);
  return (await fetchSnippet(data.id))!;
}

export async function updateSnippet(id: string, input: SnippetInput): Promise<Snippet> {
  const { error } = await supabase
    .from("pm_snippets")
    .update({
      title: input.title,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      video_url: input.video_url ?? null,
      category_id: input.category_id ?? null,
      language: input.language ?? null,
      tags: input.tags,
      project_ids: input.project_ids,
    })
    .eq("id", id);
  if (error) throw error;
  await replaceVariations(id, input.variations.length ? input.variations : [{ name: "Default", code: "" }]);
  return (await fetchSnippet(id))!;
}

export async function fetchSnippet(id: string): Promise<Snippet | null> {
  const { data, error } = await supabase
    .from("pm_snippets")
    .select("*, variations:pm_snippet_variations(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    tags: data.tags ?? [],
    project_ids: data.project_ids ?? [],
    variations: ((data.variations ?? []) as SnippetVariation[]).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  } as Snippet;
}

export async function deleteSnippet(id: string) {
  const { error } = await supabase.from("pm_snippets").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateSnippet(s: Snippet): Promise<Snippet> {
  return createSnippet({
    title: `${s.title} (Copy)`,
    description: s.description,
    instructions: s.instructions,
    video_url: s.video_url,
    category_id: s.category_id,
    language: s.language,
    tags: s.tags,
    project_ids: s.project_ids,
    variations: s.variations.map(v => ({ name: v.name, code: v.code })),
  });
}

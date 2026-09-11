import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import type { PmMilestoneDefinition, PmProject } from "@/types/pm";

export const UNSET_MILESTONE_KEY = "__unset__";
export const UNSET_MILESTONE_LABEL = "Unset";

const MILESTONE_QUERY_KEY = ["pm", "milestone_definitions"] as const;

function slugifyMilestoneKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || `milestone_${Date.now().toString(36)}`;
}

export async function fetchMilestoneDefinitions(opts?: {
  includeInactive?: boolean;
}): Promise<PmMilestoneDefinition[]> {
  let q = supabase
    .from("pm_milestone_definitions" as any)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("key", { ascending: true });
  if (!opts?.includeInactive) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as PmMilestoneDefinition[];
}

export function useMilestoneDefinitions(opts?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: [...MILESTONE_QUERY_KEY, opts?.includeInactive ? "all" : "active"] as const,
    queryFn: () => fetchMilestoneDefinitions(opts),
    staleTime: 60_000,
  });
}

export function invalidateMilestoneDefinitions() {
  return queryClient.invalidateQueries({ queryKey: MILESTONE_QUERY_KEY });
}

export function milestoneLabel(
  key: string | null | undefined,
  defs: PmMilestoneDefinition[],
): string {
  if (!key) return UNSET_MILESTONE_LABEL;
  return defs.find((d) => d.key === key)?.label ?? key.replace(/_/g, " ");
}

/** Sort order for a project milestone; Unset sorts last. */
export function milestoneSortOrder(
  key: string | null | undefined,
  defs: PmMilestoneDefinition[],
): number {
  if (!key) return Number.MAX_SAFE_INTEGER;
  const def = defs.find((d) => d.key === key);
  return def?.sort_order ?? Number.MAX_SAFE_INTEGER - 1;
}

export function compareProjectsByMilestone(
  a: Pick<PmProject, "milestone">,
  b: Pick<PmProject, "milestone">,
  defs: PmMilestoneDefinition[],
): number {
  const ao = milestoneSortOrder(a.milestone, defs);
  const bo = milestoneSortOrder(b.milestone, defs);
  if (ao !== bo) return ao - bo;
  return (a.milestone ?? "").localeCompare(b.milestone ?? "");
}

export async function createMilestoneDefinition(label: string): Promise<PmMilestoneDefinition> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");

  const { data: existing } = await supabase
    .from("pm_milestone_definitions" as any)
    .select("key")
    .order("key");
  const used = new Set(((existing ?? []) as { key: string }[]).map((r) => r.key));
  let key = slugifyMilestoneKey(trimmed);
  if (used.has(key)) {
    let n = 2;
    while (used.has(`${key}_${n}`)) n += 1;
    key = `${key}_${n}`;
  }

  const { data: maxRow } = await supabase
    .from("pm_milestone_definitions" as any)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((maxRow as { sort_order?: number } | null)?.sort_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("pm_milestone_definitions" as any)
    .insert({ key, label: trimmed, sort_order, is_active: true } as any)
    .select()
    .single();
  if (error) throw error;
  await invalidateMilestoneDefinitions();
  return data as unknown as PmMilestoneDefinition;
}

export async function updateMilestoneDefinition(
  id: string,
  patch: Partial<Pick<PmMilestoneDefinition, "label" | "sort_order" | "is_active">>,
): Promise<void> {
  const { error } = await supabase
    .from("pm_milestone_definitions" as any)
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq("id", id);
  if (error) throw error;
  await invalidateMilestoneDefinitions();
}

export async function reorderMilestoneDefinitions(
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from("pm_milestone_definitions" as any)
        .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() } as any)
        .eq("id", id),
    ),
  );
  await invalidateMilestoneDefinitions();
}

/** Soft-deactivate. Prefer over delete when projects still reference the key. */
export async function deactivateMilestoneDefinition(id: string): Promise<void> {
  await updateMilestoneDefinition(id, { is_active: false });
}

export async function countProjectsUsingMilestone(key: string): Promise<number> {
  const { count, error } = await supabase
    .from("pm_projects")
    .select("id", { count: "exact", head: true })
    .eq("milestone", key);
  if (error) throw error;
  return count ?? 0;
}

/** Hard delete only when no projects reference the key. */
export async function deleteMilestoneDefinition(id: string, key: string): Promise<void> {
  const n = await countProjectsUsingMilestone(key);
  if (n > 0) {
    throw new Error(`Cannot delete: ${n} project(s) still use this milestone. Deactivate instead.`);
  }
  const { error } = await supabase.from("pm_milestone_definitions" as any).delete().eq("id", id);
  if (error) throw error;
  await invalidateMilestoneDefinitions();
}

/** Lightweight hook that keeps a local copy for selects without waiting on React Query consumers. */
export function useMilestoneLabelMap() {
  const { data: defs = [] } = useMilestoneDefinitions({ includeInactive: true });
  const [map, setMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    setMap(new Map(defs.map((d) => [d.key, d.label])));
  }, [defs]);
  const label = useCallback(
    (key: string | null | undefined) => {
      if (!key) return UNSET_MILESTONE_LABEL;
      return map.get(key) ?? key.replace(/_/g, " ");
    },
    [map],
  );
  return { defs, label, map };
}

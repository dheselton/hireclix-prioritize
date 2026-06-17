import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PmActivity {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  default_client_id: string | null;
  billable_default: boolean;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
}

const subs = new Set<() => void>();
function emit() { subs.forEach(fn => { try { fn(); } catch {} }); }

export function useActivities(opts: { includeArchived?: boolean } = {}) {
  const [activities, setActivities] = useState<PmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("pm_activities").select("*").order("name");
    if (!opts.includeArchived) q = q.eq("is_archived", false);
    const { data } = await q;
    setActivities((data as any as PmActivity[]) ?? []);
    setLoading(false);
  }, [opts.includeArchived]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    subs.add(reload);
    return () => { subs.delete(reload); };
  }, [reload]);
  return { activities, loading, reload };
}

export async function createActivity(input: { name: string; color?: string; icon?: string; default_client_id?: string | null; billable_default?: boolean }) {
  const { data, error } = await supabase
    .from("pm_activities")
    .insert({
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      default_client_id: input.default_client_id ?? null,
      billable_default: input.billable_default ?? false,
    } as any)
    .select()
    .single();
  if (error) throw error;
  emit();
  return data as any as PmActivity;
}

export async function updateActivity(id: string, patch: Partial<Pick<PmActivity, "name" | "color" | "icon" | "default_client_id" | "billable_default" | "is_archived">>) {
  const { error } = await supabase.from("pm_activities").update(patch as any).eq("id", id);
  if (error) throw error;
  emit();
}

export async function archiveActivity(id: string) {
  return updateActivity(id, { is_archived: true });
}

export async function unarchiveActivity(id: string) {
  return updateActivity(id, { is_archived: false });
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from("pm_activities").delete().eq("id", id);
  if (error) throw error;
  emit();
}

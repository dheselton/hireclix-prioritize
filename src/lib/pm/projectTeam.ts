import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjectTeamsQuery() {
  return useQuery({
    queryKey: ["pm_project_members_map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pm_project_members")
        .select("project_id, user_id");
      const map = new Map<string, string[]>();
      for (const r of (data ?? []) as Array<{ project_id: string; user_id: string }>) {
        const arr = map.get(r.project_id) ?? [];
        if (!arr.includes(r.user_id)) arr.push(r.user_id);
        map.set(r.project_id, arr);
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Returns all project members as a map: project_id -> array of user_ids. */
export function useProjectTeamsMap() {
  const { data } = useProjectTeamsQuery();
  return data ?? new Map<string, string[]>();
}

/** Get team for a single project. */
export function useProjectTeam(projectId?: string | null): string[] {
  const map = useProjectTeamsMap();
  if (!projectId) return [];
  return map.get(projectId) ?? [];
}

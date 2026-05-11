import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/pm/mockUser";

/** Returns set of project_ids the current mock user is a member of. */
export function useMyProjectIds() {
  const { user } = useCurrentUser();
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.id) { setIds(new Set()); return; }
    let cancel = false;
    supabase.from("pm_project_members").select("project_id").eq("user_id", user.id).then(({ data }) => {
      if (cancel) return;
      setIds(new Set((data || []).map((r: any) => r.project_id)));
    });
    return () => { cancel = true; };
  }, [user?.id]);
  return ids;
}

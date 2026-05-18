import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";
import { useTasksChanged } from "@/lib/pm/refresh";

export type SubtaskCount = { done: number; total: number };

/** Fetch subtask done/total per task in a single query. */
export function useSubtaskCounts(taskIds: string[]): Map<string, SubtaskCount> {
  const [map, setMap] = useState<Map<string, SubtaskCount>>(new Map());
  const key = taskIds.slice().sort().join(",");

  async function load() {
    if (!taskIds.length) { setMap(new Map()); return; }
    const { data } = await supabase.from("pm_subtasks").select("task_id,complete").in("task_id", taskIds);
    const m = new Map<string, SubtaskCount>();
    for (const r of (data || []) as any[]) {
      const cur = m.get(r.task_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (r.complete) cur.done += 1;
      m.set(r.task_id, cur);
    }
    setMap(m);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [key]);
  useTasksChanged(() => { load(); });
  return map;
}

export function SubtaskBadge({ count }: { count?: SubtaskCount }) {
  if (!count || !count.total) return null;
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <CheckSquare className="h-3 w-3" /> {count.done}/{count.total}
    </Badge>
  );
}

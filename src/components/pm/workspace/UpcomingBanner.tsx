import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import type { RevealMode } from "@/types/pm";
import { REVEAL_MODE_LABEL } from "@/lib/pm/reveal";

const COMPLETE = new Set(["approved", "complete"]);
const STARTED = new Set(["in_progress", "in_review", "approved", "complete"]);

function satisfies(status: string | null | undefined, mode: RevealMode): boolean {
  if (!status) return true;
  if (mode === "always") return true;
  if (mode === "on_start") return STARTED.has(status);
  return COMPLETE.has(status);
}

/**
 * Shows a muted "Upcoming · waiting on {predecessor}" badge above the task
 * body when the task has at least one unmet dependency that would normally
 * hide it from default task lists. Workspace itself is always reachable.
 */
export function UpcomingBanner({ taskId }: { taskId: string }) {
  const [info, setInfo] = useState<{ predTitle: string; predId: string; mode: RevealMode } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: deps } = await supabase
        .from("pm_task_dependencies")
        .select("depends_on_task_id, reveal_mode")
        .eq("task_id", taskId);
      const rows = (deps || []) as { depends_on_task_id: string; reveal_mode?: string }[];
      if (!rows.length) { if (!cancelled) setInfo(null); return; }
      const predIds = Array.from(new Set(rows.map(r => r.depends_on_task_id)));
      const { data: preds } = await supabase
        .from("pm_tasks")
        .select("id, title, status")
        .in("id", predIds);
      const predMap = new Map((preds || []).map((p: any) => [p.id, p]));
      for (const r of rows) {
        const mode = (r.reveal_mode ?? "on_complete") as RevealMode;
        if (mode === "always") continue;
        const p: any = predMap.get(r.depends_on_task_id);
        if (!p) continue;
        if (!satisfies(p.status, mode)) {
          if (!cancelled) setInfo({ predTitle: p.title, predId: p.id, mode });
          return;
        }
      }
      if (!cancelled) setInfo(null);
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  if (!info) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <Badge variant="outline" className="text-[10px] font-medium">Upcoming</Badge>
      <span className="truncate" title={REVEAL_MODE_LABEL[info.mode]}>
        Waiting on{" "}
        <Link to={`/pm/tasks/${info.predId}`} className="text-foreground hover:underline">
          {info.predTitle}
        </Link>
      </span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2 } from "lucide-react";
import { definedPageCount } from "@/lib/pm/pageGroups";
import { useTasksChanged } from "@/lib/pm/refresh";

/**
 * Shown on the BA's "Define pages" task. Pages are defined after Discovery — this
 * is where that work happens. The task can't be completed until at least one page
 * exists (enforced in updateTask).
 */
export function DefinePagesBanner({ projectId }: { projectId: string }) {
  const [count, setCount] = useState<number | null>(null);

  const reload = async () => setCount(await definedPageCount(projectId));
  useEffect(() => { reload(); }, [projectId]);
  useTasksChanged(reload);

  const ready = (count ?? 0) > 0;

  return (
    <div
      className={`rounded-md border p-3 flex items-start gap-3 ${
        ready ? "border-success/50 bg-success/5" : "border-amber-500/60 bg-amber-500/5"
      }`}
    >
      {ready
        ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
        : <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {ready ? `${count} page(s) defined` : "No pages defined yet"}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ready
            ? "Each page has stamped its concept, design, build and QA tasks and is consuming the reserved time. Add more pages any time before you complete this task."
            : "Add every page this site needs from the project's Pages tab. Each page stamps its full task bundle and unblocks the reserved page work. This task can't be completed until at least one page exists."}
        </p>
      </div>
      <Button size="sm" variant={ready ? "outline" : "default"} asChild>
        <Link to={`/pm/projects/${projectId}?tab=pages`}>Define pages</Link>
      </Button>
    </div>
  );
}

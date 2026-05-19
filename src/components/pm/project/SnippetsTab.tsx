import { useEffect, useState } from "react";
import { Code2, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PmTask } from "@/types/pm";

interface Props {
  projectId: string;
  tasks: PmTask[];
}

type Row = {
  link_id: string;
  task_id: string;
  task_title: string;
  task_type: string;
  task_status: string;
  snippet_id: string;
  snippet_title: string;
  language: string | null;
  code: string;
};

export function SnippetsTab({ projectId, tasks }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const taskIds = tasks.map(t => t.id);
      if (!taskIds.length) {
        if (!cancel) { setRows([]); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("pm_task_snippets")
        .select(
          "id, task_id, snippet:pm_snippets(id, title, language, variations:pm_snippet_variations(code, sort_order))",
        )
        .in("task_id", taskIds);
      if (cancel) return;
      const byTask = new Map(tasks.map(t => [t.id, t]));
      const out: Row[] = [];
      for (const r of (data ?? []) as any[]) {
        const t = byTask.get(r.task_id);
        if (!t || !r.snippet) continue;
        const variations = (r.snippet.variations ?? []).slice().sort(
          (a: any, b: any) => a.sort_order - b.sort_order,
        );
        out.push({
          link_id: r.id,
          task_id: t.id,
          task_title: t.title,
          task_type: t.type,
          task_status: t.status,
          snippet_id: r.snippet.id,
          snippet_title: r.snippet.title,
          language: r.snippet.language ?? null,
          code: variations[0]?.code ?? "",
        });
      }
      setRows(out);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [projectId, tasks]);

  const handleCopy = async (row: Row) => {
    try {
      await navigator.clipboard.writeText(row.code);
      setCopiedId(row.link_id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4">Loading snippets…</div>;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center gap-2">
          <Code2 className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-sm font-medium">No snippets linked yet</div>
          <div className="text-xs text-muted-foreground">
            Go to Tasks to link snippets to individual tasks.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by task, preserve order of `tasks`
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = groups.get(r.task_id) ?? [];
    arr.push(r);
    groups.set(r.task_id, arr);
  }
  const orderedTaskIds = tasks.map(t => t.id).filter(id => groups.has(id));

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        All snippets linked to tasks in this project.
      </p>
      {orderedTaskIds.map(tid => {
        const taskRows = groups.get(tid)!;
        const head = taskRows[0];
        return (
          <Card key={tid}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <span className="text-sm font-medium truncate">{head.task_title}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {head.task_type}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                  {head.task_status.replace(/_/g, " ")}
                </Badge>
              </div>
              <ul className="space-y-1.5">
                {taskRows.map(r => (
                  <li
                    key={r.link_id}
                    className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-1.5"
                  >
                    <Code2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {r.language && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 uppercase">
                        {r.language}
                      </Badge>
                    )}
                    <span className="text-sm truncate flex-1">{r.snippet_title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs shrink-0"
                      onClick={() => handleCopy(r)}
                    >
                      {copiedId === r.link_id ? (
                        <><Check className="h-3 w-3 mr-1 text-primary" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3 mr-1" /> Copy</>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

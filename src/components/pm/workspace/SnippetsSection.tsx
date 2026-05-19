import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Code2, Copy, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { SnippetSearchPopover } from "@/components/pm/snippets/SnippetSearchPopover";
import {
  fetchTaskSnippets,
  fetchTaskSnippetIds,
  linkSnippetToTask,
  unlinkSnippetFromTask,
  type LinkedTaskSnippet,
} from "@/lib/pm/taskSnippets";

interface Props {
  taskId: string;
}

export function SnippetsSection({ taskId }: Props) {
  const [linked, setLinked] = useState<LinkedTaskSnippet[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [rows, idList] = await Promise.all([
      fetchTaskSnippets(taskId),
      fetchTaskSnippetIds(taskId),
    ]);
    setLinked(rows);
    setIds(idList);
  }, [taskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleToggle = async (snippetId: string, willLink: boolean) => {
    try {
      if (willLink) await linkSnippetToTask(taskId, snippetId);
      else await unlinkSnippetFromTask(taskId, snippetId);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update snippet link");
    }
  };

  const handleCopy = async (row: LinkedTaskSnippet) => {
    const code = row.snippet.variations[0]?.code ?? "";
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          Snippets
          {linked.length > 0 && (
            <span className="text-xs text-muted-foreground">({linked.length})</span>
          )}
        </div>
        <SnippetSearchPopover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          linkedSnippetIds={ids}
          onToggle={handleToggle}
          align="end"
        >
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Link snippet
          </Button>
        </SnippetSearchPopover>
      </div>
      <div className="p-3">
        {linked.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No snippets linked yet.</div>
        ) : (
          <ul className="space-y-2">
            {linked.map(row => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded border border-border bg-background px-2.5 py-1.5"
              >
                <Code2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Link
                  to="/snippets"
                  className="text-sm font-medium hover:underline truncate flex-1"
                >
                  {row.snippet.title}
                </Link>
                {row.snippet.language && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                    {row.snippet.language}
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleCopy(row)}
                  title="Copy code"
                >
                  {copiedId === row.id ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleToggle(row.snippet_id, false)}
                  title="Unlink"
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

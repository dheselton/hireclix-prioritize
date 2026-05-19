import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchTemplateSnippetSummary,
  type TemplateSnippetSummaryRow,
} from "@/lib/pm/taskSnippets";

interface Props {
  templateTaskIds: string[];
  refreshKey?: number;
}

export function TemplateSnippetSummary({ templateTaskIds, refreshKey }: Props) {
  const [rows, setRows] = useState<TemplateSnippetSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTemplateSnippetSummary(templateTaskIds)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [templateTaskIds.join(","), refreshKey]);

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="text-xs uppercase text-muted-foreground tracking-wide">
            Snippets in this template
          </div>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">({rows.length})</span>
          )}
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            No snippets linked to any task yet. Click a task's "Link snippets" pill to add one.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(r => (
              <li key={r.snippet_id} className="flex items-center gap-2 py-1.5">
                <Link
                  to="/snippets"
                  className="text-sm font-medium hover:underline truncate flex-1"
                >
                  {r.title}
                </Link>
                {r.category_name && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {r.category_name}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground shrink-0">
                  Used in {r.used_in_tasks} task{r.used_in_tasks === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

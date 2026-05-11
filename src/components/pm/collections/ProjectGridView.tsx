import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/pm/format";
import type { PmProject, PmTask } from "@/types/pm";

interface Props {
  projects: PmProject[];
  tasks: PmTask[];
}

export function ProjectGridView({ projects, tasks }: Props) {
  if (!projects.length) {
    return <div className="text-sm text-muted-foreground italic py-8 text-center">No projects yet.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(p => {
        const projTasks = tasks.filter(t => t.project_id === p.id);
        const done = projTasks.filter(t => t.status === "complete" || t.status === "approved").length;
        const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
        return (
          <Link key={p.id} to={`/pm/projects/${p.id}`}>
            <Card className="hover:shadow-md transition cursor-pointer h-full">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold leading-tight">{p.title}</div>
                  <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                <div className="text-xs text-muted-foreground">Go-live: {fmtDate(p.go_live_date)}</div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{done} of {projTasks.length} tasks complete</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

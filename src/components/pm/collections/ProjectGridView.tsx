import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Play } from "lucide-react";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { fmtAgo, getResumeForProject, onActivityChanged } from "@/lib/pm/activity";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import type { PmProject, PmTask } from "@/types/pm";

interface Props {
  projects: PmProject[];
  tasks: PmTask[];
  onChanged?: () => void;
}

export function ProjectGridView({ projects, tasks, onChanged }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const drawer = useTaskDrawerLink();
  const [, force] = useState(0);
  useEffect(() => onActivityChanged(() => force(v => v + 1)), []);

  function toggle(id: string, checked: boolean) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  }

  async function bulkArchive() {
    await supabase.from("pm_projects").update({ status: "archived" }).in("id", Array.from(selected));
    toast.success(`Archived ${selected.size} project${selected.size === 1 ? "" : "s"}`);
    setSelected(new Set());
    onChanged?.();
  }

  if (!projects.length) {
    return <div className="text-sm text-muted-foreground italic py-8 text-center">No projects yet. Start a Quick Request or Full Project to get going.</div>;
  }
  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={bulkArchive}>Archive</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(p => {
          const projTasks = tasks.filter(t => t.project_id === p.id);
          const done = projTasks.filter(t => t.status === "complete" || t.status === "approved").length;
          const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
          const checked = selected.has(p.id);
          const isRequest = ((p as any).work_type ?? "project") === "request";
          return (
            <Card
              key={p.id}
              className={cn("relative hover:shadow-md transition cursor-pointer h-full", checked && "ring-2 ring-primary")}
              onClick={() => navigate(`/pm/projects/${p.id}`)}
            >
              <CardContent className={cn("pl-9 space-y-3", isRequest ? "p-3" : "p-4")}>
                <div
                  className={cn("absolute left-2.5", isRequest ? "top-3" : "top-4")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(p.id, !!v)}
                    aria-label={`Select ${p.title}`}
                  />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <WorkTypeBadge workType={(p as any).work_type ?? "project"} />
                    <div className={cn("font-semibold leading-tight truncate", isRequest && "text-sm")}>{p.title}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{p.status}</Badge>
                </div>
                {!isRequest && <Badge variant="outline" className="text-[10px]">{p.type}</Badge>}
                {!isRequest && (
                  <div className="text-xs text-muted-foreground">Go-live: {fmtDate(p.go_live_date)}</div>
                )}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{isRequest ? "Tasks" : "Progress"}</span>
                    <span>{isRequest ? `${done}/${projTasks.length}` : `${pct}%`}</span>
                  </div>
                  {!isRequest && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {!isRequest && (
                    <div className="text-[11px] text-muted-foreground mt-1">{done} of {projTasks.length} tasks complete</div>
                  )}
                </div>
                {!isRequest && (() => {
                  const resume = getResumeForProject(user?.id, p.id);
                  const t = resume ? projTasks.find(x => x.id === resume.taskId && x.status !== "complete" && x.status !== "approved") : null;
                  if (!t || !resume) return null;
                  return (
                    <div
                      className="rounded-md border border-primary/30 bg-primary/5 p-2 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Play className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pick up where you left off</div>
                        <div className="text-xs font-medium truncate">{t.title}</div>
                        <div className="text-[10px] text-muted-foreground">edited {fmtAgo(resume.at)}</div>
                      </div>
                      <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => drawer.open(t.id)}>Resume</Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

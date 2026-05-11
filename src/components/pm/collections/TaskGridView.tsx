import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { StatusPill } from "@/components/pm/StatusPill";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import type { PmTask, PmProject } from "@/types/pm";
import { updateTask, logActivity } from "@/lib/pm/api";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-400", low: "bg-emerald-500",
};

interface Props {
  tasks: PmTask[];
  projects?: Map<string, PmProject>;
  onOpen: (id: string) => void;
  onChanged?: () => void;
}

export function TaskGridView({ tasks, projects, onOpen, onChanged }: Props) {
  const { user } = useCurrentUser();

  async function claim(t: PmTask, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    await updateTask(t.id, { assignee_id: user.id, status: "in_progress" });
    await logActivity({ task_id: t.id, project_id: t.project_id, user_id: user.id, action: "task.claimed" });
    toast.success(`Claimed: ${t.title}`);
    onChanged?.();
  }

  if (!tasks.length) {
    return <div className="text-sm text-muted-foreground italic py-8 text-center">No tasks.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {tasks.map(t => {
        const proj = projects?.get(t.project_id);
        return (
          <Card
            key={t.id}
            className="group relative cursor-pointer hover:shadow-md transition"
            onClick={() => onOpen(t.id)}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                </div>
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full", PRIORITY_DOT[t.priority] ?? "bg-muted")} />
              </div>
              <div className="font-medium leading-tight">{t.title}</div>
              <div className="text-xs text-muted-foreground truncate">{proj?.title ?? "—"}</div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <UserAvatar userId={t.assignee_id} size="xs" />
                  <StatusPill status={t.status} />
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtDate(t.due_date)}</span>
              </div>
            </CardContent>
            <div className="absolute inset-x-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button size="sm" className="h-7 flex-1 text-xs" onClick={(e) => claim(t, e)} disabled={t.status !== "unclaimed" && t.assignee_id === user?.id}>
                {t.status === "unclaimed" ? "Claim" : "Open"}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

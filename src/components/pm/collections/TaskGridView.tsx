import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { StatusPill } from "@/components/pm/StatusPill";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import type { PmTask, PmProject } from "@/types/pm";
import { BulkTaskActions } from "./BulkTaskActions";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { SubtaskBadge, useSubtaskCounts } from "@/components/pm/SubtaskBadge";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const subCounts = useSubtaskCounts(tasks.map(t => t.id));


  function toggle(id: string, checked: boolean) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  }

  if (!tasks.length) {
    return <div className="text-sm text-muted-foreground italic py-8 text-center">No tasks.</div>;
  }

  return (
    <div className="space-y-2">
      <BulkTaskActions selected={selected} onClear={() => setSelected(new Set())} onChanged={onChanged} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tasks.map(t => {
          const proj = projects?.get(t.project_id);
          const checked = selected.has(t.id);
          return (
            <Card
              key={t.id}
              className={cn(
                "relative cursor-pointer hover:shadow-md transition",
                checked && "ring-2 ring-primary",
                t.status === "unclaimed"
                  ? "unclaimed-card"
                  : (t.track === "pm" ? "track-border-pm" : "track-border-production"),
              )}
              onClick={() => onOpen(t.id)}
            >
              <CardContent className="p-3 pl-9 space-y-2">
                <div
                  className="absolute left-2.5 top-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(t.id, !!v)}
                    aria-label={`Select ${t.title}`}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                    <SubtaskBadge count={subCounts.get(t.id)} />
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
                  {t.status === "unclaimed"
                    ? <ClaimButton task={t} onChanged={onChanged} />
                    : <span className="text-[11px] text-muted-foreground">{fmtDate(t.due_date)}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

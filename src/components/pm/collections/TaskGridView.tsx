import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { StatusPill } from "@/components/pm/StatusPill";
import { cn } from "@/lib/utils";
import type { PmTask, PmProject } from "@/types/pm";
import { BulkTaskActions } from "./BulkTaskActions";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { SubtaskBadge, useSubtaskCounts } from "@/components/pm/SubtaskBadge";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { ClientContext } from "@/components/pm/ClientContext";
import { DueBadge, overdueAccentClass } from "@/components/pm/DueBadge";
import { clientNameForProject, useClientNamesMap } from "@/lib/pm/clients";

interface Props {
  tasks: PmTask[];
  projects?: Map<string, PmProject>;
  onOpen: (id: string) => void;
  onChanged?: () => void;
}

export function TaskGridView({ tasks, projects, onOpen, onChanged }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const subCounts = useSubtaskCounts(tasks.map(t => t.id));
  const clientNames = useClientNamesMap();

  function toggle(id: string, checked: boolean) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  }

  if (!tasks.length) {
    return <div className="text-sm text-muted-foreground italic py-8 text-center">No work here yet.</div>;
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
                overdueAccentClass(t.due_date),
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
                    <SubtaskBadge count={subCounts.get(t.id)} />
                  </div>
                  <PriorityFlag priority={t.priority} size="sm" />
                </div>

                <div className="font-medium leading-tight">{t.title}</div>
                <div className="flex items-center gap-1.5 min-w-0">
                  {proj && <WorkTypeBadge workType={(proj as any).work_type ?? "project"} />}
                  <ClientContext
                    clientName={clientNameForProject(proj, clientNames)}
                    clientId={proj?.client_id}
                    projectTitle={proj?.title}
                    taskTitle={t.title}
                    className="min-w-0"
                  />
                </div>
                <div className="flex items-center justify-between pt-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MultiAssigneeChip taskId={t.id} primaryId={t.assignee_id} size="xs" />
                    <StatusPill status={t.status} />
                  </div>
                  {t.status === "unclaimed"
                    ? <ClaimButton task={t} onChanged={onChanged} />
                    : <DueBadge dueDate={t.due_date} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

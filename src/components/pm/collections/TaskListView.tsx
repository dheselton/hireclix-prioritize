import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { MultiAssigneeChip } from "@/components/pm/MultiAssigneeChip";
import { StatusPill } from "@/components/pm/StatusPill";
import { fmtDate } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { useMockUsers } from "@/lib/pm/mockUser";
import { type PmTask, type PmProject } from "@/types/pm";
import { BulkTaskActions } from "./BulkTaskActions";
import { ClaimButton } from "@/components/pm/ClaimButton";
import { SubtaskBadge, useSubtaskCounts } from "@/components/pm/SubtaskBadge";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { PriorityFlag } from "@/components/pm/PriorityFlag";
import { TeamPill } from "@/components/pm/TeamsMultiSelect";
import { teamsFromTask } from "@/lib/pm/teams";

type SortKey = "title" | "client" | "type" | "status" | "assignee" | "due_date" | "priority";

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };


interface Props {
  tasks: PmTask[];
  projects?: Map<string, PmProject>;
  onOpen: (id: string) => void;
  onChanged?: () => void;
  enableBulk?: boolean;
}

export function TaskListView({ tasks, projects, onOpen, onChanged, enableBulk = true }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const users = useMockUsers();
  const subCounts = useSubtaskCounts(tasks.map(t => t.id));

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "title": av = a.title; bv = b.title; break;
        case "client": av = projects?.get(a.project_id)?.title ?? ""; bv = projects?.get(b.project_id)?.title ?? ""; break;
        case "type": av = a.type; bv = b.type; break;
        case "status": av = a.status; bv = b.status; break;
        case "assignee": av = users.find(u => u.id === a.assignee_id)?.name ?? ""; bv = users.find(u => u.id === b.assignee_id)?.name ?? ""; break;
        case "due_date": av = a.due_date ?? "9999"; bv = b.due_date ?? "9999"; break;
        case "priority": av = PRIORITY_RANK[a.priority] ?? 0; bv = PRIORITY_RANK[b.priority] ?? 0; break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, sortDir, projects, users]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sorted.map(t => t.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    const s = new Set(selected);
    if (checked) s.add(id); else s.delete(id);
    setSelected(s);
  }

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("p-2 font-medium select-none cursor-pointer", className)} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  return (
    <div className="space-y-2">
      {enableBulk && (
        <BulkTaskActions
          selected={selected}
          onClear={() => setSelected(new Set())}
          onChanged={onChanged}
        />
      )}

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border text-left">
            <tr>
              {enableBulk && (
                <th className="p-2 w-8">
                  <Checkbox
                    checked={selected.size > 0 && selected.size === sorted.length}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </th>
              )}
              <SortHead k="title">Title</SortHead>
              <SortHead k="client" className="hidden md:table-cell">Project</SortHead>
              <SortHead k="type" className="hidden sm:table-cell">Type</SortHead>
              <SortHead k="status">Status</SortHead>
              <SortHead k="assignee" className="hidden md:table-cell">Assignee</SortHead>
              <SortHead k="due_date">Due</SortHead>
              <SortHead k="priority" className="w-10 text-center">!</SortHead>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => {
              const proj = projects?.get(t.project_id);
              const checked = selected.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer",
                    checked && "bg-primary/5",
                    t.status === "unclaimed"
                      ? "unclaimed-row"
                      : (t.track === "pm" ? "track-border-pm" : "track-border-production"),
                  )}
                  onClick={() => onOpen(t.id)}
                >
                  {enableBulk && (
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={(v) => toggleOne(t.id, !!v)} />
                    </td>
                  )}
                  <td className="p-2 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{t.title}</span>
                      <SubtaskBadge count={subCounts.get(t.id)} />
                      <ClaimButton task={t} onChanged={onChanged} />
                    </div>
                  </td>
                  <td className="p-2 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                    <span className="inline-flex items-center gap-1.5">
                      <WorkTypeBadge workType={(proj as any)?.work_type} compact />
                      {proj?.title ?? "—"}
                    </span>
                  </td>
                  <td className="p-2 hidden sm:table-cell">
                    <div className="flex items-center gap-1 flex-wrap">
                      {teamsFromTask(t).map(tm => <TeamPill key={tm} team={tm} />)}
                      <span className="text-[10px] text-muted-foreground lowercase">{t.type}</span>
                    </div>
                  </td>
                  <td className="p-2"><StatusPill status={t.status} /></td>
                  <td className="p-2 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                    <MultiAssigneeChip taskId={t.id} primaryId={t.assignee_id} size="xs" onChanged={onChanged} />
                  </td>
                  <td className="p-2 text-muted-foreground whitespace-nowrap">{fmtDate(t.due_date)}</td>
                  <td className="p-2 text-center">
                    <PriorityFlag priority={t.priority} size="sm" />
                  </td>

                </tr>
              );
            })}
            {!sorted.length && (
              <tr><td colSpan={enableBulk ? 8 : 7} className="p-6 text-center text-muted-foreground italic">No work here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

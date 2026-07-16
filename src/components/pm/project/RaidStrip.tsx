import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Plus } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import {
  KIND_META, getTaskKind, getRaidDetails, isRaidOpen, daysSince,
  SEVERITY_STYLE, type TaskKind,
} from "@/lib/pm/taskKind";
import { cn } from "@/lib/utils";
import type { PmTask } from "@/types/pm";

interface Props {
  tasks: PmTask[];
  onLog: (kind: Extract<TaskKind, "decision" | "issue">) => void;
}

export function RaidStrip({ tasks, onLog }: Props) {
  const navigate = useNavigate();
  const openItems = useMemo(
    () => tasks.filter(t => {
      const k = getTaskKind(t);
      return (k === "decision" || k === "issue") && isRaidOpen(t);
    }),
    [tasks],
  );

  if (openItems.length === 0) return null;

  const decisions = openItems.filter(t => getTaskKind(t) === "decision");
  const risks = openItems.filter(t => getTaskKind(t) === "issue");

  return (
    <Card id="raid-log" className="border-dashed border-primary/30 bg-primary/[0.02] scroll-mt-20">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              RAID Log
            </span>
            <span className="text-[12px] text-foreground">
              {decisions.length > 0 && (
                <>
                  <span className="font-semibold">{decisions.length}</span>{" "}
                  {decisions.length === 1 ? "decision pending" : "decisions pending"}
                </>
              )}
              {decisions.length > 0 && risks.length > 0 && (
                <span className="mx-1.5 text-muted-foreground">·</span>
              )}
              {risks.length > 0 && (
                <>
                  <span className="font-semibold">{risks.length}</span>{" "}
                  {risks.length === 1 ? "risk open" : "risks open"}
                </>
              )}
            </span>
          </div>
          <LogSplitButton onLog={onLog} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {openItems.map(t => (
            <RaidChip key={t.id} task={t} onClick={() => navigate(`/pm/tasks/${t.id}`)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RaidChip({ task, onClick }: { task: PmTask; onClick: () => void }) {
  const kind = getTaskKind(task) as Extract<TaskKind, "decision" | "issue">;
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const raid = getRaidDetails(task);
  const age = daysSince(task.created_at as any);
  const sev = kind === "issue" ? raid.severity : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 max-w-[260px] flex flex-col gap-1 rounded-md border px-2.5 py-1.5 text-left transition hover:bg-muted/40",
        "bg-background border-border",
      )}
      title={task.title}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className="h-3 w-3 shrink-0" style={{ color: meta.dotHsl }} />
        <span className="text-[12px] font-medium truncate">{task.title}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {task.assignee_id ? (
          <UserAvatar userId={task.assignee_id} size="xs" />
        ) : (
          <span className="italic">Unassigned</span>
        )}
        {sev && (
          <span className={cn("px-1.5 rounded-full border text-[9px] uppercase font-semibold", SEVERITY_STYLE[sev])}>
            {sev}
          </span>
        )}
        <span>· {age === 0 ? "today" : `${age}d`}</span>
      </div>
    </button>
  );
}

function LogSplitButton({ onLog }: { onLog: (k: Extract<TaskKind, "decision" | "issue">) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Log
          <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {(["decision", "issue"] as const).map(k => {
          const meta = KIND_META[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => { setOpen(false); onLog(k); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-left"
            >
              <Icon className="h-3 w-3" style={{ color: meta.dotHsl }} />
              <span>New {meta.label.toLowerCase()}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

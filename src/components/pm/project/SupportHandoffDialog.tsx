import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Headphones } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import {
  applySupportHandoff,
  defaultHandoffDecisions,
  handoffToastMessage,
  openBuildTasks,
  type HandoffAction,
  type HandoffDecision,
} from "@/lib/pm/supportHandoff";
import { toast } from "sonner";
import type { PmProject, PmTask } from "@/types/pm";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<HandoffAction, string> = {
  complete: "Complete",
  convert: "Convert to Support",
  keep: "Keep open",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: PmProject;
  tasks: PmTask[];
  /** When false, project is already in Support — only clean up tasks. */
  enterSupportMode?: boolean;
  onDone?: () => void;
}

export function SupportHandoffDialog({
  open,
  onOpenChange,
  project,
  tasks,
  enterSupportMode = true,
  onDone,
}: Props) {
  const { user } = useCurrentUser();
  const openTasks = useMemo(() => openBuildTasks(tasks), [tasks]);
  const [decisions, setDecisions] = useState<HandoffDecision[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDecisions(defaultHandoffDecisions(tasks));
  }, [open, tasks]);

  function setAction(taskId: string, action: HandoffAction) {
    setDecisions((prev) =>
      prev.map((d) => (d.taskId === taskId ? { ...d, action } : d)),
    );
  }

  function setAll(action: HandoffAction) {
    setDecisions((prev) => prev.map((d) => ({ ...d, action })));
  }

  async function submit() {
    setBusy(true);
    try {
      const result = await applySupportHandoff({
        project,
        tasks: openTasks,
        decisions,
        enterSupportMode,
        actorId: user?.id ?? null,
      });
      toast.success(handoffToastMessage(result, enterSupportMode));
      onOpenChange(false);
      onDone?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Handoff failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-info" />
            {enterSupportMode ? "Enter Support mode" : "Handoff leftover build tasks"}
          </DialogTitle>
          <DialogDescription>
            {enterSupportMode
              ? "This site will become a Live Career Site. Choose what to do with each open build task."
              : "These build tasks are still open on a live site. Complete them, convert to Support requests, or keep them open."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setAll("complete")} disabled={busy}>
            Complete all
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setAll("convert")} disabled={busy}>
            Convert all
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setAll("keep")} disabled={busy}>
            Keep all open
          </Button>
        </div>

        <ul className="space-y-2 border border-border rounded-md divide-y divide-border max-h-72 overflow-y-auto">
          {openTasks.map((t) => {
            const decision = decisions.find((d) => d.taskId === t.id)?.action ?? "complete";
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] capitalize py-0">
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                    {t.due_date && <span>Due {t.due_date}</span>}
                  </div>
                </div>
                <div className="w-[160px]">
                  <Label className="sr-only">Action for {t.title}</Label>
                  <Select
                    value={decision}
                    onValueChange={(v) => setAction(t.id, v as HandoffAction)}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {(Object.keys(ACTION_LABEL) as HandoffAction[]).map((a) => (
                        <SelectItem key={a} value={a} className="text-xs">
                          {ACTION_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            );
          })}
          {openTasks.length === 0 && (
            <li className="px-3 py-4 text-sm text-muted-foreground text-center">
              No open build tasks
            </li>
          )}
        </ul>

        <p className={cn("text-[11px] text-muted-foreground")}>
          Convert creates a Support request under this live site and closes the build task.
          Kept tasks stay findable in list views but the site will not appear as an active build card.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy
              ? "Saving…"
              : enterSupportMode
                ? "Enter Support mode"
                : "Apply handoff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

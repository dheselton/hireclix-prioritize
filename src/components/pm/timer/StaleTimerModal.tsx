import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatHM, useActiveTimer } from "./ActiveTimerProvider";

interface StaleTimer {
  taskId: string | null;
  activityId: string | null;
  taskTitle: string;
  startedAt: number;
}

export function StaleTimerModal({ timer, onClose }: { timer: StaleTimer; onClose: () => void }) {
  const { stopWithMinutes, discardActive } = useActiveTimer();
  const elapsedMs = Date.now() - timer.startedAt;
  const totalMin = useMemo(() => Math.max(1, Math.round(elapsedMs / 60000)), [elapsedMs]);
  const [h, setH] = useState<string>(String(Math.floor(totalMin / 60)));
  const [m, setM] = useState<string>(String(totalMin % 60));
  const startedLabel = new Date(timer.startedAt).toLocaleString();

  async function logIt() {
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (mins <= 0) return;
    await stopWithMinutes(mins);
    onClose();
  }

  async function discard() {
    await discardActive();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) return; /* block outside close */ }}>
      <DialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Your timer is still running from a previous session</DialogTitle>
          <DialogDescription>
            Your timer for <strong className="text-foreground">{timer.taskTitle}</strong> started{" "}
            <strong className="text-foreground">{startedLabel}</strong> and has been running for{" "}
            <strong className="text-foreground">{formatHM(elapsedMs)}</strong>. How long were you actually working?
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Hours</Label>
            <Input type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} className="w-20" />
          </div>
          <div>
            <Label className="text-xs">Minutes</Label>
            <Input type="number" min={0} max={59} value={m} onChange={(e) => setM(e.target.value)} className="w-20" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={discard}>Discard entry</Button>
          <Button onClick={logIt}>Log this time</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

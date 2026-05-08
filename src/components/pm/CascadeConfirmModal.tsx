import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { DateDiff } from "@/lib/pm/scheduler";
import { fmtDate } from "@/lib/pm/format";

export function CascadeConfirmModal({
  open, onOpenChange, diffs, goLiveDate, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diffs: DateDiff[];
  goLiveDate?: string | null;
  onConfirm: () => void;
}) {
  const pastGoLive = goLiveDate
    ? diffs.some(d => new Date(d.newEnd) > new Date(goLiveDate))
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm date changes</DialogTitle>
        </DialogHeader>
        {pastGoLive && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span>One or more tasks now extend past go-live ({fmtDate(goLiveDate)}).</span>
          </div>
        )}
        <div className="max-h-80 overflow-y-auto border border-border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                <th className="p-2 font-medium">Task</th>
                <th className="p-2 font-medium">Was</th>
                <th className="p-2 font-medium">Now</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map(d => (
                <tr key={d.taskId} className="border-t border-border">
                  <td className="p-2">{d.title}</td>
                  <td className="p-2 text-muted-foreground text-xs">{fmtDate(d.oldStart)} → {fmtDate(d.oldEnd)}</td>
                  <td className="p-2 text-xs"><Badge variant="outline">{fmtDate(d.newStart)} → {fmtDate(d.newEnd)}</Badge></td>
                </tr>
              ))}
              {!diffs.length && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No tasks would shift.</td></tr>}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(); onOpenChange(false); }} disabled={!diffs.length}>Apply changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, Trash2 } from "lucide-react";

interface Round {
  id: string; task_id: string; round_number: number;
  submitted_date: string | null; feedback_notes: string | null;
  status: "pending" | "approved" | "needs_revision";
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  needs_revision: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

export function DesignRoundsSection({ taskId }: { taskId: string }) {
  const [rounds, setRounds] = useState<Round[]>([]);

  async function load() {
    const { data } = await supabase.from("pm_design_rounds").select("*").eq("task_id", taskId).order("round_number");
    setRounds((data || []) as Round[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function addRound() {
    const next = (rounds[rounds.length - 1]?.round_number ?? 0) + 1;
    await supabase.from("pm_design_rounds").insert({ task_id: taskId, round_number: next, status: "pending" } as any);
    await load();
  }
  async function patch(id: string, p: Partial<Round>) {
    await supabase.from("pm_design_rounds").update(p as any).eq("id", id);
    await load();
  }
  async function remove(id: string) {
    await supabase.from("pm_design_rounds").delete().eq("id", id);
    await load();
  }

  return (
    <SectionShell
      title="Design Rounds"
      badge={<Badge variant="secondary" className="ml-1">{rounds.length}</Badge>}
      right={<Button size="sm" variant="ghost" className="h-7" onClick={addRound}><Plus className="h-3 w-3 mr-1" /> Add round</Button>}
    >
      <div className="space-y-3">
        {rounds.map(r => (
          <div key={r.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-sm">
                Round {r.round_number}
                {r.status === "approved" && <Check className="h-4 w-4 text-emerald-600" />}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_BADGE[r.status]}>{r.status.replace("_", " ")}</Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(r.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Submitted</div>
                <DatePicker value={r.submitted_date} onChange={v => patch(r.id, { submitted_date: v })} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <Select value={r.status} onValueChange={(v: any) => patch(r.id, { status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="needs_revision">Needs revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Feedback</div>
              <Textarea rows={2} value={r.feedback_notes ?? ""}
                onChange={e => setRounds(rs => rs.map(x => x.id === r.id ? { ...x, feedback_notes: e.target.value } : x))}
                onBlur={e => patch(r.id, { feedback_notes: e.target.value })} />
            </div>
          </div>
        ))}
        {!rounds.length && <div className="text-xs text-muted-foreground italic">No rounds yet.</div>}
      </div>
    </SectionShell>
  );
}

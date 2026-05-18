import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { fmtDate } from "@/lib/pm/format";
import { toast } from "sonner";

interface Entry { id: string; task_id: string; user_id: string; minutes: number; note: string | null; logged_at: string; }

function fmtDur(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
}

export function TimeTrackingSection({ taskId }: { taskId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [note, setNote] = useState("");
  const { user } = useCurrentUser();
  const users = useMockUsers();

  async function load() {
    const { data } = await supabase.from("pm_time_entries").select("*").eq("task_id", taskId).order("logged_at", { ascending: false });
    setEntries((data || []) as Entry[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function quick(min: number) {
    if (!user) return;
    await supabase.from("pm_time_entries").insert({ task_id: taskId, user_id: user.id, minutes: min, note: "" } as any);
    toast.success(`Logged ${min}m`);
    await load();
  }
  async function saveManual() {
    if (!user) return;
    const mins = (Number(h) || 0) * 60 + (Number(m) || 0);
    if (!mins) { toast.error("Enter a duration"); return; }
    await supabase.from("pm_time_entries").insert({ task_id: taskId, user_id: user.id, minutes: mins, note: note || "" } as any);
    setH(""); setM(""); setNote("");
    await load();
  }

  const total = entries.reduce((s, e) => s + e.minutes, 0);

  return (
    <SectionShell
      title="Time Tracking"
      badge={<Badge variant="secondary" className="ml-1">{fmtDur(total)} logged</Badge>}
    >
      <div className="flex gap-2 mb-3">
        <Button size="sm" variant="outline" onClick={() => quick(15)}>+15m</Button>
        <Button size="sm" variant="outline" onClick={() => quick(30)}>+30m</Button>
        <Button size="sm" variant="outline" onClick={() => quick(60)}>+1h</Button>
      </div>

      <div className="space-y-1 mb-3 max-h-48 overflow-auto">
        {entries.map(e => {
          const u = users.find(x => x.id === e.user_id);
          return (
            <div key={e.id} className="flex items-start gap-2 text-sm px-2 py-1 rounded hover:bg-muted/40">
              <UserAvatar userId={e.user_id} size="xs" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{u?.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(e.logged_at?.slice(0, 10))}</span>
                </div>
                {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
              </div>
              <Badge variant="secondary">{fmtDur(e.minutes)}</Badge>
            </div>
          );
        })}
        {!entries.length && <div className="text-xs text-muted-foreground italic px-2">No time logged.</div>}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Manual entry</div>
        <div className="flex gap-2">
          <Input type="number" min={0} placeholder="h" value={h} onChange={e => setH(e.target.value)} className="h-8 w-16" />
          <Input type="number" min={0} max={59} placeholder="m" value={m} onChange={e => setM(e.target.value)} className="h-8 w-16" />
          <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="h-8 flex-1" />
          <Button size="sm" onClick={saveManual}>Save</Button>
        </div>
      </div>
    </SectionShell>
  );
}

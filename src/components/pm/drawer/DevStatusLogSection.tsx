import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import type { PmTask } from "@/types/pm";

interface Entry { id?: string; created_at: string; note: string; author_id?: string | null; author_name?: string; legacy?: boolean; }

export function DevStatusLogSection({ task }: { task: PmTask }) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const { user } = useCurrentUser();
  const users = useMockUsers();

  async function load() {
    const { data } = await supabase.from("pm_dev_status_log").select("*").eq("task_id", task.id).order("created_at");
    setRows((data || []).map((r: any) => ({ id: r.id, created_at: r.created_at, note: r.note, author_id: r.author_id })) as Entry[]);
  }
  useEffect(() => { load(); }, [task.id]);

  async function submit() {
    if (!draft.trim()) return;
    await supabase.from("pm_dev_status_log").insert({ task_id: task.id, note: draft.trim(), author_id: user?.id ?? null } as any);
    setDraft("");
    await load();
  }

  const merged = useMemo(() => {
    const legacy: Entry[] = (task.dev_status_log || []).map(l => ({
      created_at: l.at, note: l.note, author_name: l.by, legacy: true,
    }));
    return [...legacy, ...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [task.dev_status_log, rows]);

  return (
    <SectionShell
      title="Status Log"
      badge={<Badge variant="secondary" className="ml-1">{merged.length}</Badge>}
    >
      <div className="font-mono text-xs bg-muted/40 rounded p-2 max-h-56 overflow-auto space-y-1">
        {merged.map((r, i) => {
          const author = r.author_name ?? users.find(u => u.id === r.author_id)?.name ?? "—";
          return (
            <div key={r.id ?? `legacy-${i}`} className="border-b border-border/40 last:border-0 pb-1">
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              {" · "}<span className="text-foreground/80">{author}</span>
              {r.legacy && <span className="ml-1 text-[10px] opacity-60">(legacy)</span>}
              <div>{r.note}</div>
            </div>
          );
        })}
        {!merged.length && <div className="text-muted-foreground italic">No log entries yet.</div>}
      </div>
      <div className="flex gap-2 mt-2">
        <Input placeholder="Add a log entry…" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }} className="h-8 font-mono" />
        <Button size="sm" onClick={submit}>Submit</Button>
      </div>
    </SectionShell>
  );
}

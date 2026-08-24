import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { PmRole, PmUser } from "@/types/pm";

const ROLE_OPTIONS: PmRole[] = [
  "pm", "ba", "tech_lead", "designer", "developer", "submitter",
  "strategist", "analyst", "qa", "csm", "support",
];

export default function Team() {
  const [rows, setRows] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("pm_users")
      .select("*")
      .order("is_active", { ascending: true })
      .order("name");
    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as PmUser[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const pending = useMemo(() => rows.filter(r => !r.is_active), [rows]);
  const active = useMemo(() => rows.filter(r => r.is_active), [rows]);

  async function patch(id: string, updates: Partial<PmUser>) {
    setBusyId(id);
    const { error: uErr } = await supabase.from("pm_users").update(updates as any).eq("id", id);
    setBusyId(null);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success("Updated");
    await reload();
  }

  function RoleSelect({ user }: { user: PmUser }) {
    const current = (user.roles?.[0] || user.role) as PmRole;
    return (
      <Select
        value={current}
        disabled={busyId === user.id}
        onValueChange={(v) => {
          const role = v as PmRole;
          void patch(user.id, { role, roles: [role] });
        }}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map(r => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function PersonRow({ user, pendingRow }: { user: PmUser; pendingRow?: boolean }) {
    return (
      <Card className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{user.name}</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingRow && <Badge variant="outline">Pending</Badge>}
          <RoleSelect user={user} />
          {pendingRow ? (
            <Button
              size="sm"
              disabled={busyId === user.id}
              onClick={() => void patch(user.id, { is_active: true })}
            >
              Approve
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === user.id}
              onClick={() => void patch(user.id, { is_active: false })}
            >
              Deactivate
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="page-shell space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-[20px] font-medium leading-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          New HireClix Google accounts wait here until a PM or BA approves access.
        </p>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading roster…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Pending approval ({pending.length})</h2>
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">No pending accounts.</p>
            )}
            {pending.map(u => <PersonRow key={u.id} user={u} pendingRow />)}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Active ({active.length})</h2>
            {active.map(u => <PersonRow key={u.id} user={u} />)}
          </section>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import type { PmRole, PmUser } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { ChevronDown } from "lucide-react";

const ROLE_OPTIONS: PmRole[] = [
  "pm", "ba", "tech_lead", "designer", "developer", "submitter",
  "strategist", "analyst", "qa", "csm", "support",
];

function jobsFromUser(user: PmUser): PmRole[] {
  if (user.roles?.length) return user.roles as PmRole[];
  const list = [user.role, user.secondary_role].filter(Boolean) as PmRole[];
  return list.length ? list : [user.role];
}

export default function Team() {
  const { isAdmin: meIsAdmin } = useCurrentUser();
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

  function RolesEditor({ user }: { user: PmUser }) {
    const selected = jobsFromUser(user);
    const label = selected.length
      ? selected.join(", ")
      : "No jobs";

    function toggle(role: PmRole, on: boolean) {
      let next = on
        ? [...selected, role]
        : selected.filter((r) => r !== role);
      // De-dupe while preserving order
      next = Array.from(new Set(next));
      if (!next.length) {
        toast.error("Keep at least one job role");
        return;
      }
      void patch(user.id, { role: next[0], roles: next, secondary_role: null });
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 max-w-[200px] text-xs justify-between gap-1"
            disabled={busyId === user.id}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground px-1 pb-1">
              Job roles (union). First is primary for track.
            </p>
            {ROLE_OPTIONS.map((r) => {
              const checked = selected.includes(r);
              return (
                <label
                  key={r}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(r, v === true)}
                    disabled={busyId === user.id}
                  />
                  <span>{r}</span>
                  {selected[0] === r && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0">primary</Badge>
                  )}
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  function AdminToggle({ user }: { user: PmUser }) {
    if (!meIsAdmin) {
      return user.is_admin ? (
        <Badge variant="secondary" className="text-[10px]">Admin</Badge>
      ) : null;
    }
    return (
      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
        <Checkbox
          checked={!!user.is_admin}
          disabled={busyId === user.id}
          onCheckedChange={(v) => void patch(user.id, { is_admin: v === true })}
        />
        <span>Admin</span>
      </label>
    );
  }

  function PersonRow({ user, pendingRow }: { user: PmUser; pendingRow?: boolean }) {
    return (
      <Card className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-2">
            {user.name}
            {user.is_admin && !meIsAdmin && (
              <Badge variant="secondary" className="text-[10px]">Admin</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingRow && <Badge variant="outline">Pending</Badge>}
          <RolesEditor user={user} />
          <AdminToggle user={user} />
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
          New HireClix Google accounts wait here until a PM, BA, or admin approves access.
          Assign one or more job roles; Admin is a separate overlay for full visibility and roster control.
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

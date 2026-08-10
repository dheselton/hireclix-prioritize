import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

interface Member { id: string; user_id: string; role: string }

const SLOTS: { role: string; label: string }[] = [
  { role: "PM", label: "PM" },
  { role: "BA", label: "BA" },
  { role: "Designer", label: "Lead Designer" },
  { role: "Developer", label: "Dev" },
];

export function ProjectAssignmentsBar({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Member[]>([]);
  const { roles } = useCurrentUser();
  const users = useMockUsers();
  const canEdit = roles.some(r => r === "pm" || r === "ba" || r === "tech_lead");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("pm_project_members")
      .select("id, user_id, role")
      .eq("project_id", projectId);
    setRows(((data as any[]) ?? []) as Member[]);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function assign(role: string, userId: string) {
    try {
      const existingSlot = rows.find(r => r.role === role);
      const existingMember = rows.find(r => r.user_id === userId);
      if (existingSlot && existingSlot.user_id === userId) return;
      if (existingSlot) {
        const { error } = await supabase.from("pm_project_members").delete().eq("id", existingSlot.id);
        if (error) throw error;
      }
      if (existingMember && existingMember.id !== existingSlot?.id) {
        const { error } = await supabase.from("pm_project_members")
          .update({ role }).eq("id", existingMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pm_project_members")
          .insert({ project_id: projectId, user_id: userId, role } as any);
        if (error) throw error;
      }
      await load();
      toast.success(`${role} assigned`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not assign");
    }
  }

  async function clear(role: string) {
    const slot = rows.find(r => r.role === role);
    if (!slot) return;
    try {
      const { error } = await supabase.from("pm_project_members").delete().eq("id", slot.id);
      if (error) throw error;
      await load();
      toast.success(`${role} cleared`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not clear assignment");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Assignments</span>
      {SLOTS.map(slot => {
        const member = rows.find(r => r.role === slot.role);
        const u = member ? users.find(x => x.id === member.user_id) : undefined;
        return (
          <div key={slot.role} className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-muted-foreground">{slot.label}</span>
            <SlotPicker
              disabled={!canEdit}
              current={member?.user_id ?? null}
              onPick={id => assign(slot.role, id)}
            >
              <button
                type="button"
                disabled={!canEdit}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted disabled:cursor-default"
              >
                {member ? (
                  <>
                    <UserAvatar userId={member.user_id} size="sm" />
                    <span className="truncate max-w-[110px]">{u?.name ?? "Unknown"}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Unassigned</span>
                  </>
                )}
              </button>
            </SlotPicker>
            {member && canEdit && (
              <Button
                size="icon" variant="ghost"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                aria-label={`Clear ${slot.label}`}
                onClick={() => clear(slot.role)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotPicker({ children, current, onPick, disabled }: {
  children: React.ReactNode;
  current: string | null;
  onPick: (userId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const users = useMockUsers();
  if (disabled) return <>{children}</>;
  const list = users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 space-y-2">
        <Input placeholder="Search user…" value={search} onChange={e => setSearch(e.target.value)} className="h-8" />
        <div className="max-h-56 overflow-auto rounded border border-border">
          {list.map(u => (
            <button
              key={u.id} type="button"
              onClick={() => { onPick(u.id); setOpen(false); setSearch(""); }}
              className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted flex items-center gap-2 ${current === u.id ? "bg-muted" : ""}`}
            >
              <UserAvatar userId={u.id} size="sm" />
              <span className="truncate">{u.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
            </button>
          ))}
          {!list.length && <div className="px-2 py-2 text-xs text-muted-foreground italic">No matches</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

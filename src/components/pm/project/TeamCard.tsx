import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Member { id: string; project_id: string; user_id: string; role: string }
const PROJECT_ROLES = ["PM", "Alt PM", "BA", "Tech Lead", "Designer", "Developer", "Reviewer"];
const PM_LIKE_ROLES = new Set(["PM", "Alt PM", "BA"]);

export function TeamCard({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Member[]>([]);
  const [pickUser, setPickUser] = useState<string>("");
  const [pickRole, setPickRole] = useState<string>("Designer");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { user, roles } = useCurrentUser();
  const users = useMockUsers();

  async function load() {
    const { data } = await supabase.from("pm_project_members").select("*").eq("project_id", projectId);
    setRows((data || []) as Member[]);
  }
  useEffect(() => { load(); }, [projectId]);

  const isPM = roles.includes("pm");
  const pmCount = rows.filter(r => PM_LIKE_ROLES.has(r.role)).length;

  async function add() {
    if (!pickUser) return;
    if (rows.some(r => r.user_id === pickUser)) { toast.error("Already a member"); return; }
    await supabase.from("pm_project_members").insert({ project_id: projectId, user_id: pickUser, role: pickRole } as any);
    setPickUser(""); setSearch(""); setOpen(false);
    await load();
  }
  async function remove(m: Member) {
    if (PM_LIKE_ROLES.has(m.role) && pmCount <= 1) { toast.error("Cannot remove the only PM/BA on this project"); return; }
    await supabase.from("pm_project_members").delete().eq("id", m.id);
    await load();
  }

  const available = users.filter(u =>
    !rows.some(r => r.user_id === u.id) &&
    (!search || u.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase text-muted-foreground">Team</div>
        {isPM && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"><Plus className="h-3 w-3 mr-1" />Add</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2">
              <Input placeholder="Search user…" value={search} onChange={e => setSearch(e.target.value)} className="h-8" />
              <div className="max-h-40 overflow-auto rounded border border-border">
                {available.map(u => (
                  <button key={u.id} type="button" onClick={() => setPickUser(u.id)}
                    className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted flex items-center gap-2 ${pickUser === u.id ? "bg-muted" : ""}`}>
                    <UserAvatar userId={u.id} size="sm" />
                    <span>{u.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
                  </button>
                ))}
                {!available.length && <div className="px-2 py-2 text-xs text-muted-foreground italic">No matches</div>}
              </div>
              <Select value={pickRole} onValueChange={setPickRole}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="w-full" onClick={add} disabled={!pickUser}>Add to project</Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {rows.length === 0 && <div className="text-xs text-muted-foreground italic">No members yet.</div>}
      <ul className="space-y-1">
        {rows.map(m => {
          const u = users.find(x => x.id === m.user_id);
          const isPmLike = PM_LIKE_ROLES.has(m.role);
          const canRemove = isPM && !(isPmLike && pmCount <= 1);
          return (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <UserAvatar userId={m.user_id} size="sm" />
              <span className="flex-1 truncate">{u?.name ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground">{m.role}</span>
              {canRemove && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(m)}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </CardContent></Card>
  );
}

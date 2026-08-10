import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { Plus, X, Eye, Inbox } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";

interface Member { id: string; project_id: string; user_id: string; role: string }
const PROJECT_ROLES = ["PM", "Alt PM", "BA", "Tech Lead", "Designer", "Developer", "Reviewer", "Watcher"];
const PM_LIKE_ROLES = new Set(["PM", "Alt PM", "BA"]);

const isWatcher = (r: string) => r.toLowerCase() === "watcher";
const isRequester = (r: string) => r.toLowerCase() === "requester";

export function TeamCard({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Member[]>([]);
  const [pickUser, setPickUser] = useState<string>("");
  const [pickRole, setPickRole] = useState<string>("Designer");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { user, roles } = useCurrentUser();
  const users = useMockUsers();
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [openTaskCount, setOpenTaskCount] = useState<number | null>(null);

  async function load() {
    const { data } = await supabase.from("pm_project_members").select("*").eq("project_id", projectId);
    setRows((data || []) as Member[]);
  }
  useEffect(() => { load(); }, [projectId]);

  const isPM = roles.includes("pm");
  const pmCount = rows.filter(r => PM_LIKE_ROLES.has(r.role)).length;

  const team = rows.filter(r => !isWatcher(r.role) && !isRequester(r.role));
  const watchers = rows.filter(r => isWatcher(r.role));
  const requesters = rows.filter(r => isRequester(r.role));

  async function add() {
    if (!pickUser) return;
    if (rows.some(r => r.user_id === pickUser)) { toast.error("Already a member"); return; }
    await supabase.from("pm_project_members").insert({ project_id: projectId, user_id: pickUser, role: pickRole } as any);
    setPickUser(""); setSearch(""); setOpen(false);
    await load();
  }

  /** Count this person's still-open tasks on the project (primary or co-assignee). */
  async function countOpenTasks(userId: string) {
    const OPEN = ["unclaimed", "claimed", "todo", "in_progress", "in_review", "blocked"];
    const { data: primary } = await supabase
      .from("pm_tasks").select("id, status")
      .eq("project_id", projectId).eq("assignee_id", userId);
    const { data: co } = await supabase
      .from("pm_task_assignees").select("task_id").eq("user_id", userId);
    const coIds = ((co as any[]) ?? []).map(r => r.task_id);
    let coOpen: any[] = [];
    if (coIds.length) {
      const { data } = await supabase
        .from("pm_tasks").select("id, status")
        .eq("project_id", projectId).in("id", coIds);
      coOpen = (data as any[]) ?? [];
    }
    const all = new Map<string, string>();
    for (const t of [...(((primary as any[]) ?? [])), ...coOpen]) all.set(t.id, t.status);
    return [...all.values()].filter(s => OPEN.includes(s)).length;
  }

  async function beginRemove(m: Member) {
    setPendingRemove(m);
    setOpenTaskCount(null);
    if (!isWatcher(m.role) && !isRequester(m.role)) {
      try { setOpenTaskCount(await countOpenTasks(m.user_id)); } catch { setOpenTaskCount(null); }
    } else {
      setOpenTaskCount(0);
    }
  }

  async function remove(m: Member) {
    if (PM_LIKE_ROLES.has(m.role) && pmCount <= 1) { toast.error("Cannot remove the only PM/BA on this project"); return; }
    try {
      const { error } = await supabase.from("pm_project_members").delete().eq("id", m.id);
      if (error) throw error;
      await load();
      toast.success("Member removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove member");
    }
  }

  const available = users.filter(u =>
    !rows.some(r => r.user_id === u.id) &&
    (!search || u.name.toLowerCase().includes(search.toLowerCase()))
  );

  function renderRow(m: Member, opts?: { muted?: boolean }) {
    const u = users.find(x => x.id === m.user_id);
    const isPmLike = PM_LIKE_ROLES.has(m.role);
    const canRemove = isPM && !(isPmLike && pmCount <= 1);
    return (
      <li key={m.id} className="flex items-center gap-2 text-sm">
        <UserAvatar userId={m.user_id} size="sm" />
        <span className={`flex-1 truncate ${opts?.muted ? "text-muted-foreground" : ""}`}>{u?.name ?? "Unknown"}</span>
        <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
        {canRemove && (
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => beginRemove(m)}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </li>
    );
  }

  const pendingName = users.find(u => u.id === pendingRemove?.user_id)?.name ?? "this member";
  const removeDescription = pendingRemove
    ? (openTaskCount && openTaskCount > 0
        ? `${pendingName} still owns ${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} on this project. Removing them leaves that work without an owner — reassign it first, or remove them and reassign from the board.`
        : `Remove ${pendingName} from this project? This cannot be undone.`)
    : "";

  return (
    <Card><CardContent className="p-4 space-y-3">
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
              <p className="text-[11px] text-muted-foreground leading-snug">
                Team members do the work. Watchers only follow updates — neither creates task ownership,
                and tasks can have multiple assignees.
              </p>
              <Button size="sm" className="w-full" onClick={add} disabled={!pickUser}>Add to project</Button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {rows.length === 0 && <div className="text-xs text-muted-foreground italic">No members yet.</div>}

      {team.length > 0 && <ul className="space-y-1">{team.map(m => renderRow(m))}</ul>}

      {watchers.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Eye className="h-3 w-3" /> Watchers · {watchers.length}
          </div>
          <ul className="space-y-1">{watchers.map(m => renderRow(m, { muted: true }))}</ul>
        </div>
      )}

      {requesters.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Inbox className="h-3 w-3" /> Requested by · {requesters.length}
          </div>
          <ul className="space-y-1">{requesters.map(m => renderRow(m, { muted: true }))}</ul>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={o => { if (!o) { setPendingRemove(null); setOpenTaskCount(null); } }}
        title={openTaskCount && openTaskCount > 0 ? "Remove member with open tasks?" : "Remove member?"}
        description={removeDescription}
        confirmLabel="Remove"
        onConfirm={async () => { if (pendingRemove) await remove(pendingRemove); setPendingRemove(null); setOpenTaskCount(null); }}
      />
    </CardContent></Card>
  );
}

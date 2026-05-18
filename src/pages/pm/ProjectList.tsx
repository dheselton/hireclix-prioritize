import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus } from "lucide-react";
import { fetchProjects, fetchTasks, createProject } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject, PmTask } from "@/types/pm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useViewMode } from "@/hooks/useViewMode";
import { ProjectListView } from "@/components/pm/collections/ProjectListView";
import { ProjectGridView } from "@/components/pm/collections/ProjectGridView";
import { ProjectWorkGrid } from "@/components/pm/collections/ProjectWorkGrid";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useMeMode } from "@/hooks/useMeMode";
import { useChipFilters } from "@/hooks/useChipFilters";
import { useMyProjectIds } from "@/hooks/useMyProjectIds";
import { applyProjectChips, applyProjectMeMode } from "@/lib/pm/filters";

export default function ProjectList() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useCurrentUser();
  const [mode, setMode] = useViewMode("projects", "projects");
  const drawer = useTaskDrawerLink();
  const { isMe } = useMeMode();
  const chips = useChipFilters("projects");
  const memberIds = useMyProjectIds();

  const reload = async () => {
    const [p, t, c] = await Promise.all([
      fetchProjects(), fetchTasks(),
      supabase.from("clients").select("id,name").then(r => r.data || []),
    ]);
    setProjects(p); setTasks(t); setClients(c);
  };
  useEffect(() => { reload(); }, []);
  useTasksChanged(reload);

  const visible = useMemo(() => {
    let v = applyProjectMeMode(projects, isMe, user?.id, memberIds);
    v = applyProjectChips(v, tasks, chips.active, user?.id, memberIds);
    return v;
  }, [projects, tasks, isMe, user?.id, memberIds, chips.active]);

  const [form, setForm] = useState<any>({ title: "", type: "quick_request", status: "active", client_id: "", go_live_date: "" });

  async function submit() {
    if (!form.title.trim()) return;
    await createProject({
      title: form.title, type: form.type, status: form.status,
      client_id: form.client_id || null, go_live_date: form.go_live_date || null,
      start_date: new Date().toISOString().slice(0,10),
      created_by: user?.id ?? null,
    });
    toast.success("Project created");
    setOpen(false); setForm({ title: "", type: "quick_request", status: "active", client_id: "", go_live_date: "" });
    reload();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <CollectionToolbar
        title="Projects"
        subtitle={`${visible.length} of ${projects.length} total`}
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        modes={["projects", "list", "grid"]}
        chipState={{ ...chips, hide: ["watching"] }}
        actions={user?.role === "submitter" ? null : <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>}
      />

      {mode === "projects" ? (
        (() => {
          const visIds = new Set(visible.map(p => p.id));
          const projMap = new Map(visible.map(p => [p.id, p]));
          const scopedTasks = tasks.filter(t => t.project_id && visIds.has(t.project_id));
          return (
            <ProjectWorkGrid
              tasks={scopedTasks}
              projects={projMap}
              meId={user?.id ?? null}
              onOpenTask={drawer.open}
              onChanged={reload}
              hideLoose
            />
          );
        })()
      ) : mode === "list" ? (
        <ProjectListView projects={visible} tasks={tasks} />
      ) : (
        <ProjectGridView projects={visible} tasks={tasks} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Client</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">{PROJECT_STATUSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Go-Live Date</Label><DatePicker value={form.go_live_date} onChange={v => setForm({ ...form, go_live_date: v ?? "" })} /></div>
          </div>
          <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <TaskDrawer />
    </div>
  );
}

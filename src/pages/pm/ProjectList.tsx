import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { fetchProjects, fetchTasks, createProject } from "@/lib/pm/api";
import type { PmProject, PmTask } from "@/types/pm";
import { fmtDate } from "@/lib/pm/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ProjectList() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useCurrentUser();

  const reload = async () => {
    const [p, t, c] = await Promise.all([
      fetchProjects(), fetchTasks(),
      supabase.from("clients").select("id,name").then(r => r.data || []),
    ]);
    setProjects(p); setTasks(t); setClients(c);
  };
  useEffect(() => { reload(); }, []);

  const [form, setForm] = useState<any>({ title: "", type: "quick_request", status: "active", client_id: "", go_live_date: "" });

  async function submit() {
    if (!form.title.trim()) return;
    const p = await createProject({
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-unbounded">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} total</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-left">
                <th className="p-3 font-medium">Project</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Go-Live</th>
                <th className="p-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const projTasks = tasks.filter(t => t.project_id === p.id);
                const done = projTasks.filter(t => t.status === "complete" || t.status === "approved").length;
                const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3"><Link to={`/pm/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link></td>
                    <td className="p-3"><Badge variant="outline">{p.type}</Badge></td>
                    <td className="p-3"><Badge variant="outline">{p.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{fmtDate(p.go_live_date)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[140px] h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!projects.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No projects yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
            <div><Label>Go-Live Date</Label><Input type="date" value={form.go_live_date} onChange={e => setForm({ ...form, go_live_date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

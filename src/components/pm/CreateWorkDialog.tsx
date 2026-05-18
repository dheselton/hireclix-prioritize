import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, FolderKanban, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createProject } from "@/lib/pm/api";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/types/pm";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

type Step = "select" | "request" | "project";

export function CreateWorkDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useCurrentUser();
  const [step, setStep] = useState<Step>("select");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  // Request form
  const [reqForm, setReqForm] = useState({ title: "", client_id: "", description: "" });
  const [quickTasks, setQuickTasks] = useState<string[]>([""]);

  // Project form
  const [projForm, setProjForm] = useState({
    title: "", type: "career_site", status: "active", client_id: "",
    kickoff_date: "", go_live_date: "",
  });

  useEffect(() => {
    if (!open) return;
    setStep("select");
    setReqForm({ title: "", client_id: "", description: "" });
    setQuickTasks([""]);
    setProjForm({ title: "", type: "career_site", status: "active", client_id: "", kickoff_date: "", go_live_date: "" });
    (async () => {
      const { data } = await supabase.from("clients").select("id,name").order("name");
      setClients(data || []);
    })();
  }, [open]);

  async function submitRequest() {
    if (!reqForm.title.trim() || !reqForm.client_id) {
      toast.error("Title and client are required");
      return;
    }
    setBusy(true);
    try {
      const proj = await createProject({
        title: reqForm.title.trim(),
        type: "quick_request",
        work_type: "request",
        status: "active",
        client_id: reqForm.client_id,
        description: reqForm.description.trim() || null,
        start_date: new Date().toISOString().slice(0, 10),
        created_by: user?.id ?? null,
      } as any);
      const titles = quickTasks.map(t => t.trim()).filter(Boolean).slice(0, 3);
      if (titles.length) {
        await supabase.from("pm_tasks").insert(titles.map((title, i) => ({
          project_id: proj.id,
          title,
          type: "design",
          status: "unclaimed",
          priority: "medium",
          duration_days: 1,
          sort_order: i * 10,
          created_by: user?.id ?? null,
        })) as any);
      }
      toast.success("Request created");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create request");
    } finally {
      setBusy(false);
    }
  }

  async function submitProject() {
    if (!projForm.title.trim()) { toast.error("Title is required"); return; }
    setBusy(true);
    try {
      await createProject({
        title: projForm.title.trim(),
        type: projForm.type as any,
        work_type: "project",
        status: projForm.status as any,
        client_id: projForm.client_id || null,
        kickoff_date: projForm.kickoff_date || null,
        start_date: projForm.kickoff_date || new Date().toISOString().slice(0, 10),
        go_live_date: projForm.go_live_date || null,
        created_by: user?.id ?? null,
      } as any);
      toast.success("Project created");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Create new work" : step === "request" ? "New Quick Request" : "New Full Project"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button type="button" onClick={() => setStep("request")} className="text-left">
              <Card className="h-full hover:border-primary transition cursor-pointer">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-muted p-2"><Zap className="h-4 w-4" /></div>
                    <div className="font-semibold">Quick Request</div>
                  </div>
                  <p className="text-sm text-muted-foreground">Small tasks, quick turnaround (1–3 tasks).</p>
                </CardContent>
              </Card>
            </button>
            <button type="button" onClick={() => setStep("project")} className="text-left">
              <Card className="h-full hover:border-primary transition cursor-pointer">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-[hsl(var(--role-pm)/0.12)] text-[hsl(var(--role-pm))] p-2"><FolderKanban className="h-4 w-4" /></div>
                    <div className="font-semibold">Full Project</div>
                  </div>
                  <p className="text-sm text-muted-foreground">Multi-phase work with timeline and dependencies.</p>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {step === "request" && (
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={reqForm.title} onChange={e => setReqForm({ ...reqForm, title: e.target.value })} placeholder="What do you need?" />
            </div>
            <div>
              <Label>Client *</Label>
              <Select value={reqForm.client_id} onValueChange={v => setReqForm({ ...reqForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-border bg-background p-2 text-sm"
                value={reqForm.description}
                onChange={e => setReqForm({ ...reqForm, description: e.target.value })}
                placeholder="Optional details…"
              />
            </div>
            <div>
              <Label>Quick tasks (optional, up to 3)</Label>
              <div className="space-y-1.5 mt-1">
                {quickTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={t}
                      onChange={e => {
                        const next = [...quickTasks]; next[i] = e.target.value; setQuickTasks(next);
                      }}
                      placeholder={`Task ${i + 1}`}
                    />
                    {quickTasks.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => setQuickTasks(quickTasks.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {quickTasks.length < 3 && (
                  <Button size="sm" variant="ghost" onClick={() => setQuickTasks([...quickTasks, ""])}>
                    <Plus className="h-3 w-3 mr-1" /> Add task
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "project" && (
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Client</Label>
              <Select value={projForm.client_id} onValueChange={v => setProjForm({ ...projForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={projForm.type} onValueChange={v => setProjForm({ ...projForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {PROJECT_TYPES.filter(t => t !== "quick_request").map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={projForm.status} onValueChange={v => setProjForm({ ...projForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Kickoff Date</Label>
                <DatePicker value={projForm.kickoff_date} onChange={v => setProjForm({ ...projForm, kickoff_date: v ?? "" })} />
              </div>
              <div>
                <Label>Go-Live Date</Label>
                <DatePicker value={projForm.go_live_date} onChange={v => setProjForm({ ...projForm, go_live_date: v ?? "" })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: to instantiate phases &amp; tasks from a template, use Templates → Use template.
            </p>
          </div>
        )}

        {step !== "select" && (
          <DialogFooter className={cn("gap-2")}>
            <Button variant="outline" onClick={() => setStep("select")} disabled={busy}>Back</Button>
            <Button onClick={step === "request" ? submitRequest : submitProject} disabled={busy}>
              Create
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

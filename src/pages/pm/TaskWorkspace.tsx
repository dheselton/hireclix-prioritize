import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { logActivity, updateTask } from "@/lib/pm/api";
import { recordTaskActivity } from "@/lib/pm/activity";
import { emitTasksChanged } from "@/lib/pm/refresh";
import type { PmTask, TaskStatus } from "@/types/pm";
import { cn } from "@/lib/utils";

import { ControlPanel } from "@/components/pm/workspace/ControlPanel";
import { LinksSection } from "@/components/pm/workspace/LinksSection";
import { AssetHub } from "@/components/pm/workspace/AssetHub";
import { CollabHub } from "@/components/pm/workspace/CollabHub";
import { QuickChecklist } from "@/components/pm/workspace/QuickChecklist";
import { TimerPill } from "@/components/pm/workspace/TimerPill";
import { DependenciesSection } from "@/components/pm/drawer/DependenciesSection";
import { DesignRoundsSection } from "@/components/pm/drawer/DesignRoundsSection";
import { BlockerBanner } from "@/components/pm/drawer/Banners";

const TRACK_COLOR: Record<string, string> = {
  pm: "hsl(var(--track-pm))",
  production: "hsl(var(--track-production))",
  strategy: "hsl(var(--role-designer))",
  analytics: "hsl(var(--role-developer))",
};

function trackColor(t?: string | null) {
  return TRACK_COLOR[t ?? ""] ?? "hsl(var(--primary))";
}

interface Crumbs {
  projectTitle: string;
  clientName: string;
  phaseName: string;
}

export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { user } = useCurrentUser();
  const [task, setTask] = useState<PmTask | null>(null);
  const [crumbs, setCrumbs] = useState<Crumbs>({ projectTitle: "", clientName: "", phaseName: "" });
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<TaskStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("pm_tasks").select("*").eq("id", id).maybeSingle();
      const t = (data as any) ?? null;
      setTask(t);
      setLoading(false);
      if (!t) return;
      prevStatusRef.current = t.status;
      if (user?.id) recordTaskActivity(user.id, t.project_id, t.id);

      const [{ data: proj }, { data: phase }] = await Promise.all([
        supabase
          .from("pm_projects")
          .select("title, clients(name)")
          .eq("id", t.project_id)
          .maybeSingle(),
        t.phase_id
          ? supabase.from("pm_project_phases").select("name").eq("id", t.phase_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setCrumbs({
        projectTitle: (proj as any)?.title ?? "",
        clientName: (proj as any)?.clients?.name ?? "",
        phaseName: (phase as any)?.name ?? "",
      });
    })();
  }, [id, user?.id]);

  async function patch(p: Partial<PmTask>) {
    if (!task) return;
    try {
      const updated = await updateTask(task.id, p);
      setTask(updated as any);
      await logActivity({ task_id: task.id, project_id: task.project_id, user_id: user?.id, action: "task.updated", payload: p });
      emitTasksChanged();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "unknown error"}`);
    }
  }

  function openQuickEdit() {
    setParams(prev => { const p = new URLSearchParams(prev); p.set("task", task!.id); return p; });
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading task…</div>;
  if (!task) return <div className="p-8">Task not found. <Button variant="link" onClick={() => navigate("/pm")}>Back to Work Queue</Button></div>;

  const dotColor = trackColor(task.track);

  return (
    <div className="min-h-full bg-muted/10">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="text-xs text-muted-foreground truncate">
              <button className="hover:underline" onClick={() => navigate("/pm/projects")}>Projects</button>
              <span className="mx-1.5">/</span>
              {crumbs.projectTitle && (
                <>
                  <button className="hover:underline" onClick={() => navigate(`/pm/projects/${task.project_id}`)}>
                    {crumbs.clientName || crumbs.projectTitle}
                  </button>
                  {crumbs.phaseName && (
                    <>
                      <span className="mx-1.5">/</span>
                      <span>{crumbs.phaseName}</span>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TimerPill taskId={task.id} taskTitle={task.title} />
              <Button variant="outline" size="sm" onClick={openQuickEdit}>
                <Pencil className="h-3 w-3 mr-1" /> Quick edit
              </Button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <Input
              value={task.title}
              onChange={e => setTask({ ...task, title: e.target.value })}
              onBlur={e => patch({ title: e.target.value })}
              className="text-xl font-bold border-0 px-0 h-auto py-0.5 focus-visible:ring-0 shadow-none bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* BODY: 1fr / 300px */}
      <div
        className="max-w-[1400px] mx-auto px-4 py-6 grid gap-6"
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
        >
          <div
            className="contents lg:grid lg:gap-6"
            style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}
          >
            {/* LEFT */}
            <div className="space-y-6 min-w-0">
              {task.status === "blocked" && <BlockerBanner />}
              <AssetHub taskId={task.id} projectId={task.project_id} />
              <LinksSection taskId={task.id} />
              <CollabHub taskId={task.id} projectId={task.project_id} taskTitle={task.title} />
            </div>

            {/* RIGHT */}
            <aside className="space-y-3">
              <ControlPanel task={task} setTask={setTask} patch={patch} />
              <QuickChecklist taskId={task.id} />

              <CollapsedSection label="Show Dependencies">
                <DependenciesSection taskId={task.id} />
              </CollapsedSection>

              {task.type === "design" && (
                <CollapsedSection label="Show Design Rounds">
                  <DesignRoundsSection taskId={task.id} />
                </CollapsedSection>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapsedSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium cursor-pointer hover:bg-muted/40 transition rounded-lg"
      >
        <span>{label}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

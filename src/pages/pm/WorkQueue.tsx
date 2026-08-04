import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, FolderKanban } from "lucide-react";
import { CreateWorkDialog } from "@/components/pm/CreateWorkDialog";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { UnclaimedBanner } from "@/components/pm/UnclaimedBanner";
import { supabase } from "@/integrations/supabase/client";
import { CollapsibleSection } from "@/components/pm/CollapsibleSection";
import { TaskListByType } from "@/components/pm/workqueue/TaskListByType";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import { useTasksChanged } from "@/lib/pm/refresh";
import type { PmProject, PmTask } from "@/types/pm";

import { useBriefingData } from "@/lib/pm/briefing";
import { DailyBriefingHero } from "@/components/pm/workqueue/DailyBriefingHero";
import { QuickTasksColumn } from "@/components/pm/workqueue/QuickTasksColumn";
import { ProjectWorkColumn } from "@/components/pm/workqueue/ProjectWorkColumn";
import { NotesSection } from "@/components/pm/workqueue/NotesSection";
import { SupportHandoffCallout } from "@/components/pm/workqueue/SupportHandoffCallout";
import { ActivityDigest } from "@/components/pm/workqueue/ActivityDigest";

export default function WorkQueue() {
  const { user, role } = useCurrentUser();
  const drawer = useTaskDrawerLink();
  const [createOpen, setCreateOpen] = useState<null | "request" | "project">(null);

  // Submitter-only data (preserved from prior version)
  const isSubmitter = role === "submitter";
  const [latestFormSlug, setLatestFormSlug] = useState<string | null>(null);
  const [mySubmitted, setMySubmitted] = useState<PmTask[]>([]);
  const [submitterProjects, setSubmitterProjects] = useState<PmProject[]>([]);
  const [phaseNames, setPhaseNames] = useState<Map<string, string>>(new Map());
  const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());

  const reloadSubmitter = async () => {
    if (!isSubmitter || !user?.id) return;
    const [t, p] = await Promise.all([fetchTasks(), fetchProjects()]);
    setMySubmitted((t as PmTask[]).filter((x) => x.created_by === user.id));
    setSubmitterProjects(p as PmProject[]);
  };

  useEffect(() => {
    if (!isSubmitter) return;
    reloadSubmitter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitter, user?.id]);

  useTasksChanged(() => { if (isSubmitter) reloadSubmitter(); });

  useEffect(() => {
    if (!isSubmitter) return;
    let cancelled = false;
    (async () => {
      const [{ data: cs }, { data: ph }, { data: f }] = await Promise.all([
        supabase.from("clients").select("id, name"),
        supabase.from("pm_project_phases").select("id, name"),
        supabase.from("pm_forms").select("shareable_slug").not("shareable_slug", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      setClientNames(new Map((cs ?? []).map((r: any) => [r.id, r.name])));
      setPhaseNames(new Map((ph ?? []).map((r: any) => [r.id, r.name])));
      setLatestFormSlug((f as any)?.shareable_slug ?? null);
    })();
    return () => { cancelled = true; };
  }, [isSubmitter]);

  // --- Briefing data for non-submitters ---
  const { counts, quickTasks, unclaimedQuickTasks, projects, loading } = useBriefingData(isSubmitter ? null : user?.id);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const projById = new Map(submitterProjects.map((p) => [p.id, p]));

  if (isSubmitter) {
    return (
      <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold">Need something new?</div>
              <div className="text-muted-foreground">Submit a request through one of our intake forms.</div>
            </div>
            {latestFormSlug ? (
              <Button asChild>
                <a href={`/f/${latestFormSlug}`}>
                  Submit a new request <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            ) : (
              <Button disabled variant="outline">No forms available</Button>
            )}
          </CardContent>
        </Card>

        <CollapsibleSection
          id="section-my-requests"
          title="My Requests"
          count={mySubmitted.length}
          storageKey="pm.wq.mySubmitted"
        >
          <TaskListByType
            variant="request"
            tasks={mySubmitted}
            projects={projById}
            phaseNames={phaseNames}
            clientNames={clientNames}
            onOpen={drawer.open}
            onChanged={reloadSubmitter}
            emptyHint="You haven't submitted any requests yet."
          />
        </CollapsibleSection>

        <TaskDrawer />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <UnclaimedBanner hideCta />

      <DailyBriefingHero firstName={firstName} counts={counts} />

      <div className="flex items-center justify-end gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setCreateOpen("request")}>
          <Zap className="h-4 w-4 mr-1" /> Quick Request
        </Button>
        <Button size="sm" onClick={() => setCreateOpen("project")}>
          <FolderKanban className="h-4 w-4 mr-1" /> Project
        </Button>
      </div>

      <SupportHandoffCallout />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 mb-4">
        <QuickTasksColumn tasks={quickTasks} totalCount={counts.quickTasks} unclaimed={unclaimedQuickTasks} />
        <ProjectWorkColumn projects={projects} />
      </div>

      {user?.id && <ActivityDigest userId={user.id} />}

      {user?.id && <NotesSection userId={user.id} />}

      {loading && (
        <div className="text-xs text-muted-foreground text-center mt-3">Loading…</div>
      )}

      <TaskDrawer />
      <CreateWorkDialog
        open={createOpen !== null}
        onOpenChange={(v) => { if (!v) setCreateOpen(null); }}
        initialStep={createOpen ?? "select"}
        onCreated={() => { /* briefing data auto-refreshes via emitTasksChanged */ }}
      />
    </div>
  );
}

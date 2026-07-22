/**
 * QA / Go-live testing mode helpers.
 *
 * Parallels supportMode.ts. When a project enters QA mode, a dedicated QA
 * triage tab appears and QA-kind tickets are separated from the main build
 * board so a flood of client-reported bugs doesn't drown out other work.
 *
 * Mode state lives on pm_projects.custom_fields.qa_mode_at (ISO string).
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitTasksChanged } from "./refresh";
import { toast } from "sonner";
import type { PmProject } from "@/types/pm";

export function isInQaMode(project: Pick<PmProject, "custom_fields"> | null | undefined): boolean {
  return !!(project?.custom_fields as any)?.qa_mode_at;
}

export function useEnterQaMode(project: PmProject | null | undefined) {
  const [busy, setBusy] = useState(false);
  const enter = useCallback(async () => {
    if (!project) return;
    setBusy(true);
    try {
      const next = { ...(project.custom_fields ?? {}), qa_mode_at: new Date().toISOString() };
      const { error } = await supabase
        .from("pm_projects")
        .update({ custom_fields: next })
        .eq("id", project.id);
      if (error) throw error;
      toast.success("Project is now in QA mode");
      emitTasksChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not enter QA mode");
    } finally {
      setBusy(false);
    }
  }, [project]);
  return { enter, busy };
}

export function useExitQaMode(project: PmProject | null | undefined) {
  const [busy, setBusy] = useState(false);
  const exit = useCallback(async () => {
    if (!project) return;
    setBusy(true);
    try {
      const next = { ...(project.custom_fields ?? {}) };
      delete next.qa_mode_at;
      const { error } = await supabase
        .from("pm_projects")
        .update({ custom_fields: next })
        .eq("id", project.id);
      if (error) throw error;
      toast.success("Exited QA mode");
      emitTasksChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not exit QA mode");
    } finally {
      setBusy(false);
    }
  }, [project]);
  return { exit, busy };
}

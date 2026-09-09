/**
 * Support-mode task handoff — complete, convert to Support request, or keep open.
 */
import { supabase } from "@/integrations/supabase/client";
import { updateTask } from "@/lib/pm/api";
import { createCareerSiteSupportRequest } from "@/lib/pm/supportQueue";
import { clearSupportPromptDismissal } from "@/lib/pm/supportMode";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { isDone, type PmProject, type PmTask, type TaskStatus } from "@/types/pm";
import type { CreationSource } from "@/lib/pm/attribution";

export type HandoffAction = "complete" | "convert" | "keep";

export type HandoffDecision = {
  taskId: string;
  action: HandoffAction;
};

export type ApplySupportHandoffInput = {
  project: PmProject;
  tasks: PmTask[];
  decisions: HandoffDecision[];
  /** When false, skip stamping support_mode_at (already-live cleanup). Default true. */
  enterSupportMode?: boolean;
  actorId?: string | null;
};

export type ApplySupportHandoffResult = {
  completed: number;
  converted: number;
  kept: number;
};

export function openBuildTasks(tasks: PmTask[]): PmTask[] {
  return tasks.filter((t) => !isDone(t.status as TaskStatus));
}

/** Default every open task to Complete. */
export function defaultHandoffDecisions(tasks: PmTask[]): HandoffDecision[] {
  return openBuildTasks(tasks).map((t) => ({ taskId: t.id, action: "complete" as const }));
}

export function summarizeHandoffDecisions(decisions: HandoffDecision[]): ApplySupportHandoffResult {
  return {
    completed: decisions.filter((d) => d.action === "complete").length,
    converted: decisions.filter((d) => d.action === "convert").length,
    kept: decisions.filter((d) => d.action === "keep").length,
  };
}

/**
 * Apply handoff decisions, optionally enter Support mode.
 * Convert creates a careersite_support request under this live site, then completes the build task.
 */
export async function applySupportHandoff(
  input: ApplySupportHandoffInput,
): Promise<ApplySupportHandoffResult> {
  const { project, tasks, decisions, actorId } = input;
  const enterSupport = input.enterSupportMode !== false;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const counts = summarizeHandoffDecisions(decisions);

  for (const d of decisions) {
    const task = byId.get(d.taskId);
    if (!task || isDone(task.status as TaskStatus)) continue;

    if (d.action === "keep") continue;

    if (d.action === "convert") {
      if (!project.client_id) {
        throw new Error(`Cannot convert "${task.title}" — project has no client`);
      }
      const { project: request } = await createCareerSiteSupportRequest({
        title: task.title,
        clientId: project.client_id,
        parentProjectId: project.id,
        requestType: "careersite_support",
        description: task.description,
        dueDate: task.due_date,
        createdBy: actorId ?? null,
        requestedBy: actorId ?? null,
        taskTitles: [task.title],
        creationSource: "automation" as CreationSource,
        creationContext: {
          source: "support-handoff-convert",
          from_task_id: task.id,
          build_project_id: project.id,
        },
        customFields: {
          handed_off_from_task_id: task.id,
        },
      });

      if (task.assignee_id) {
        const { data: reqTasks } = await supabase
          .from("pm_tasks")
          .select("id")
          .eq("project_id", request.id)
          .order("sort_order")
          .limit(1);
        const newTaskId = (reqTasks as { id: string }[] | null)?.[0]?.id;
        if (newTaskId) {
          await updateTask(newTaskId, {
            assignee_id: task.assignee_id,
            status: "claimed",
            type: task.type,
            priority: task.priority,
          } as Partial<PmTask>);
        }
      }
    }

    // complete and convert both close the original build task
    try {
      await updateTask(task.id, { status: "complete" });
    } catch (err) {
      // Define-pages guard etc. — fall back to approved if complete blocked
      const message = err instanceof Error ? err.message : "";
      if (/Define at least one page/i.test(message)) {
        await updateTask(task.id, { status: "approved" });
      } else {
        throw err;
      }
    }
  }

  if (enterSupport) {
    const next = { ...(project.custom_fields ?? {}), support_mode_at: new Date().toISOString() };
    delete (next as { qa_mode_at?: string }).qa_mode_at;
    const { error } = await supabase
      .from("pm_projects")
      .update({ custom_fields: next })
      .eq("id", project.id);
    if (error) throw error;
    clearSupportPromptDismissal(project.id);
  }

  emitTasksChanged();
  return counts;
}

export function handoffToastMessage(
  result: ApplySupportHandoffResult,
  enteredSupport: boolean,
): string {
  const parts: string[] = [];
  if (enteredSupport) parts.push("Now a Live Career Site");
  if (result.completed) parts.push(`${result.completed} completed`);
  if (result.converted) parts.push(`${result.converted} converted to Support`);
  if (result.kept) parts.push(`${result.kept} kept open`);
  return parts.join(" · ") || "Support handoff saved";
}

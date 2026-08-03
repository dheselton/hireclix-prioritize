/**
 * Intake Triage Inbox helpers.
 *
 * The inbox surfaces untriaged intake work — tasks that are still `unclaimed`
 * on request/project records — so PMs and BAs can assign, prioritize, convert
 * or decline them in one pass. Declining is stored on the task's
 * `custom_fields.declined` (there is no `cancelled` task status) so declined
 * rows disappear from the default queue but stay auditable.
 */
import { updateTask, logActivity } from "@/lib/pm/api";
import type { PmTask } from "@/types/pm";

export interface DeclineInfo {
  reason: string;
  at: string;
  by?: string | null;
}

export function declineInfo(task: PmTask): DeclineInfo | null {
  const d = (task.custom_fields as any)?.declined;
  if (!d || typeof d !== "object" || !d.at) return null;
  return d as DeclineInfo;
}

export const isDeclined = (task: PmTask) => !!declineInfo(task);

/** Mark a task as declined with a reason. Keeps the row for the Declined tab. */
export async function declineTask(task: PmTask, reason: string, userId?: string | null) {
  const custom_fields = {
    ...(task.custom_fields || {}),
    declined: { reason, at: new Date().toISOString(), by: userId ?? null } satisfies DeclineInfo,
  };
  await updateTask(task.id, { custom_fields } as Partial<PmTask>);
  await logActivity({
    task_id: task.id,
    project_id: task.project_id,
    user_id: userId ?? undefined,
    action: "task.declined",
    payload: { title: task.title, reason },
  });
}

/** Undo a decline — puts the request back into the triage queue. */
export async function restoreTask(task: PmTask, userId?: string | null) {
  const custom_fields = { ...(task.custom_fields || {}) };
  delete (custom_fields as any).declined;
  await updateTask(task.id, { custom_fields } as Partial<PmTask>);
  await logActivity({
    task_id: task.id,
    project_id: task.project_id,
    user_id: userId ?? undefined,
    action: "task.decline_reverted",
    payload: { title: task.title },
  });
}

/** 120-char snippet used on inbox rows. */
export function snippet(text: string | null | undefined, max = 120): string {
  if (!text) return "";
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

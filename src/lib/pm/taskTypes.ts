import { TASK_TYPES, type TaskType } from "@/types/pm";

/** Primary type from the row + secondary types from `type:*` tags. */
export function typesFromTask(task: { type: TaskType; tags?: string[] | null }): TaskType[] {
  const secondary: TaskType[] = [];
  for (const tag of task.tags ?? []) {
    if (!tag.startsWith("type:")) continue;
    const t = tag.slice(5) as TaskType;
    if (!TASK_TYPES.includes(t) || t === task.type || secondary.includes(t)) continue;
    secondary.push(t);
  }
  return [task.type, ...secondary];
}

/** Keep non-type tags; rewrite `type:*` tags to match secondary types. */
export function syncTypeTags(existingTags: string[] | undefined | null, types: TaskType[]): string[] {
  const nonTypeTags = (existingTags ?? []).filter(t => !t.startsWith("type:"));
  const extraTypeTags = types.slice(1).map(t => `type:${t}`);
  return [...nonTypeTags, ...extraTypeTags];
}

import type { PmTask, PmDependency, DepType } from '@/types/pm';

export interface DateDiff {
  taskId: string;
  title: string;
  oldStart: string | null;
  oldEnd: string | null;
  newStart: string;
  newEnd: string;
}

const day = 86400000;
const toDate = (s: string | null | undefined) => (s ? new Date(s + 'T00:00:00') : null);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * day);

/**
 * Recalculate downstream tasks after a task's dates change.
 * Returns a diff list. Does NOT write to DB.
 */
export function recalculateForward(
  changedTaskId: string,
  proposed: { start: string; end: string },
  tasks: PmTask[],
  deps: PmDependency[],
): DateDiff[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
  const incoming = new Map<string, PmDependency[]>();
  const outgoing = new Map<string, PmDependency[]>();
  for (const d of deps) {
    if (!incoming.has(d.task_id)) incoming.set(d.task_id, []);
    incoming.get(d.task_id)!.push(d);
    if (!outgoing.has(d.depends_on_task_id)) outgoing.set(d.depends_on_task_id, []);
    outgoing.get(d.depends_on_task_id)!.push(d);
  }

  const diffs: DateDiff[] = [];
  const start = taskMap.get(changedTaskId);
  if (!start) return diffs;
  const oldStart = start.start_date;
  const oldEnd = start.due_date;
  start.start_date = proposed.start;
  start.due_date = proposed.end;
  if (oldStart !== proposed.start || oldEnd !== proposed.end) {
    diffs.push({ taskId: changedTaskId, title: start.title, oldStart, oldEnd, newStart: proposed.start, newEnd: proposed.end });
  }

  // BFS downstream
  const queue = [changedTaskId];
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const out = outgoing.get(id) || [];
    for (const dep of out) {
      const dependent = taskMap.get(dep.task_id);
      const predecessor = taskMap.get(dep.depends_on_task_id);
      if (!dependent || !predecessor || !predecessor.start_date || !predecessor.due_date) continue;

      const predStart = toDate(predecessor.start_date)!;
      const predEnd = toDate(predecessor.due_date)!;
      let newStart: Date;
      switch (dep.type as DepType) {
        case 'start_start':
          newStart = addDays(predStart, dep.lag_days || 0);
          break;
        case 'finish_finish': {
          const newEnd = addDays(predEnd, dep.lag_days || 0);
          newStart = addDays(newEnd, -(dependent.duration_days - 1));
          break;
        }
        case 'finish_start':
        default:
          newStart = addDays(predEnd, (dep.lag_days || 0) + 1);
      }
      const newEnd = addDays(newStart, dependent.duration_days - 1);
      const ns = fmt(newStart), ne = fmt(newEnd);
      const curStart = dependent.start_date, curEnd = dependent.due_date;
      // Only push if it actually moves later (don't pull tasks earlier automatically)
      if (!curStart || !curEnd || toDate(ns)!.getTime() > toDate(curStart)!.getTime()) {
        diffs.push({ taskId: dependent.id, title: dependent.title, oldStart: curStart, oldEnd: curEnd, newStart: ns, newEnd: ne });
        dependent.start_date = ns;
        dependent.due_date = ne;
        queue.push(dependent.id);
      }
    }
  }
  return diffs;
}

/**
 * Reverse-schedule the entire project working backwards from a go-live date.
 */
export function recalculateBackwardFromGoLive(
  goLive: string,
  tasks: PmTask[],
  deps: PmDependency[],
): DateDiff[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
  const dependents = new Map<string, PmDependency[]>(); // predecessor -> deps where it's depended on
  const predecessors = new Map<string, PmDependency[]>(); // task -> deps it has
  for (const d of deps) {
    if (!predecessors.has(d.task_id)) predecessors.set(d.task_id, []);
    predecessors.get(d.task_id)!.push(d);
    if (!dependents.has(d.depends_on_task_id)) dependents.set(d.depends_on_task_id, []);
    dependents.get(d.depends_on_task_id)!.push(d);
  }
  // Tasks with no dependents are "leaves" (closest to go-live)
  const leaves = tasks.filter(t => !dependents.get(t.id)?.length);
  const goLiveDate = toDate(goLive)!;
  const newEndById = new Map<string, Date>();

  // Set leaves to end at go-live
  for (const t of leaves) {
    newEndById.set(t.id, goLiveDate);
  }

  // Topological reverse pass: ensure each task ends before its dependents start
  let changed = true; let iter = 0;
  while (changed && iter++ < 100) {
    changed = false;
    for (const t of tasks) {
      const out = dependents.get(t.id) || [];
      let earliestDependentStart: Date | null = null;
      for (const dep of out) {
        const depTask = taskMap.get(dep.task_id);
        if (!depTask) continue;
        const depEnd = newEndById.get(depTask.id);
        if (!depEnd) continue;
        const depStart = addDays(depEnd, -(depTask.duration_days - 1));
        let constraintEnd: Date;
        switch (dep.type) {
          case 'start_start':
            constraintEnd = addDays(depStart, t.duration_days - 1 - (dep.lag_days || 0));
            break;
          case 'finish_finish':
            constraintEnd = addDays(depEnd, -(dep.lag_days || 0));
            break;
          case 'finish_start':
          default:
            constraintEnd = addDays(depStart, -(dep.lag_days || 0) - 1);
        }
        if (!earliestDependentStart || constraintEnd < earliestDependentStart) {
          earliestDependentStart = constraintEnd;
        }
      }
      const desired = earliestDependentStart ?? goLiveDate;
      const cur = newEndById.get(t.id);
      if (!cur || cur.getTime() !== desired.getTime()) {
        newEndById.set(t.id, desired);
        changed = true;
      }
    }
  }

  const diffs: DateDiff[] = [];
  for (const t of tasks) {
    const end = newEndById.get(t.id);
    if (!end) continue;
    const start = addDays(end, -(t.duration_days - 1));
    const ns = fmt(start), ne = fmt(end);
    if (t.start_date !== ns || t.due_date !== ne) {
      diffs.push({ taskId: t.id, title: t.title, oldStart: t.start_date, oldEnd: t.due_date, newStart: ns, newEnd: ne });
    }
  }
  return diffs;
}

/**
 * Critical path = longest duration chain ending at a leaf (latest go-live).
 */
export function computeCriticalPath(tasks: PmTask[], deps: PmDependency[]): Set<string> {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const predecessors = new Map<string, PmDependency[]>();
  for (const d of deps) {
    if (!predecessors.has(d.task_id)) predecessors.set(d.task_id, []);
    predecessors.get(d.task_id)!.push(d);
  }
  const memo = new Map<string, { length: number; chain: string[] }>();
  function longest(id: string): { length: number; chain: string[] } {
    if (memo.has(id)) return memo.get(id)!;
    const t = taskMap.get(id);
    if (!t) return { length: 0, chain: [] };
    const preds = predecessors.get(id) || [];
    let best = { length: t.duration_days, chain: [id] };
    for (const p of preds) {
      const sub = longest(p.depends_on_task_id);
      const cand = { length: sub.length + t.duration_days, chain: [...sub.chain, id] };
      if (cand.length > best.length) best = cand;
    }
    memo.set(id, best);
    return best;
  }
  let winner = { length: 0, chain: [] as string[] };
  for (const t of tasks) {
    const r = longest(t.id);
    if (r.length > winner.length) winner = r;
  }
  return new Set(winner.chain);
}

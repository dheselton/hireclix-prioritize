// Tiny pub/sub so drawer edits notify list/board/queue pages to refetch.
import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

const subs = new Set<() => void>();

export function emitTasksChanged() {
  // React Query consumers share these requests and refresh once per key.
  // Keep the legacy subscribers below while remaining screens are migrated.
  void queryClient.invalidateQueries({ queryKey: ["pm", "tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["pm", "projects"] });
  void queryClient.invalidateQueries({ queryKey: ["pm_task_assignees_map"] });
  void queryClient.invalidateQueries({ queryKey: ["pm_project_members_map"] });
  subs.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function useTasksChanged(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = () => ref.current();
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
}

// Cascade-on-date-change pub/sub. TaskDrawer (or any future editor) emits a
// proposed { taskId, start, end } and ProjectDetail runs recalculateForward
// + opens CascadeConfirmModal before anything is written to the DB.
export interface TaskDateProposal { taskId: string; start: string; end: string; }
const dateSubs = new Set<(p: TaskDateProposal) => void>();

export function emitTaskDateProposed(p: TaskDateProposal) {
  dateSubs.forEach((fn) => { try { fn(p); } catch {} });
}

export function useTaskDateProposed(handler: (p: TaskDateProposal) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (p: TaskDateProposal) => ref.current(p);
    dateSubs.add(fn);
    return () => { dateSubs.delete(fn); };
  }, []);
}

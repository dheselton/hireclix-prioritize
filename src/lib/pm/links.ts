import type { ChipId } from "@/hooks/useChipFilters";
import type { WorkTypeFilter } from "@/hooks/useWorkTypeFilter";

export interface QueueLinkOpts {
  chips?: ChipId[];
  section?: string;
  workType?: WorkTypeFilter;
  base?: string; // default /pm
}

/**
 * Build a deep link into the Work Queue (or any list view) with chip filters,
 * a work-type toggle preset, and/or a section anchor pre-applied.
 *
 * Every CTA, alert, and stat tile in the PM app should use this helper rather
 * than hand-crafting URLs. See mem://design/clickable-callouts.
 */
export function buildQueueLink(opts: QueueLinkOpts = {}): string {
  // Default to /pm/work — the canonical "see everything" view. It honors
  // chips/workType/section params (via useChipFilters("board") +
  // useWorkTypeFilter("board"), same storage keys as the old /pm/board route).
  // Callers can override `base` for project-scoped links (e.g., /pm/projects/:id).
  const base = opts.base ?? "/pm/work";
  const params = new URLSearchParams();
  if (opts.chips && opts.chips.length) params.set("chips", opts.chips.join(","));
  if (opts.workType && opts.workType !== "all") params.set("workType", opts.workType);
  if (opts.section) params.set("section", opts.section);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Project-scoped stat link: lands on the project's Tasks tab with a status
 * filter pre-applied. Used by KPI tiles, Overview callouts and mini-metrics so
 * every number on a project page opens the exact set of tasks it counts.
 */
export type ProjectTaskFilterId = "overdue" | "blocked" | "open" | "in_review" | "done";

export function projectFilterLink(projectId: string, filter?: ProjectTaskFilterId): string {
  const base = buildQueueLink({ base: `/pm/projects/${projectId}`, section: "tasks" });
  return filter ? `${base}&taskFilter=${filter}` : base;
}

/**
 * Client-scoped stat link: lands on /pm/work filtered to one client's projects
 * (`?client=`), optionally with chip filters pre-applied. Used by every number
 * on the client hub so no count is a dead end.
 */
export function clientWorkLink(clientId: string, chips: ChipId[] = []): string {
  const link = buildQueueLink({ chips });
  return link.includes("?") ? `${link}&client=${clientId}` : `${link}?client=${clientId}`;
}



/** Strip our deep-link params from the URL without triggering navigation. */
export function consumeQueueLinkParams(keys: string[] = ["chips", "workType", "section", "taskFilter"]) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const k of keys) {
    if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; }
  }
  if (changed) window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
}

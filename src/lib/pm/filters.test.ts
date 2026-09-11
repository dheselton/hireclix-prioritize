import { describe, expect, it } from "vitest";
import {
  applyWorkScope,
  isRecentlyDone,
  isRetiredProject,
  RECENTLY_DONE_WINDOW_HOURS,
  RETIRED_PROJECT_STATUSES,
} from "@/lib/pm/filters";
import type { PmProject, PmTask } from "@/types/pm";

const now = new Date("2026-09-10T15:00:00.000Z");

function makeProject(overrides: Partial<PmProject> & { id: string; status: PmProject["status"] }): PmProject {
  return {
    title: "Project",
    client_id: null,
    type: "career_site",
    work_type: "project",
    go_live_date: null,
    start_date: null,
    kickoff_date: null,
    description: null,
    tags: [],
    template_id: null,
    created_by: null,
    custom_fields: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<PmTask> & { id: string; project_id: string; status: PmTask["status"] }): PmTask {
  return {
    phase_id: null,
    title: "Task",
    description: null,
    type: "dev",
    assignee_id: null,
    created_by: null,
    start_date: null,
    due_date: null,
    duration_days: 1,
    min_duration_days: null,
    sort_order: 0,
    priority: "medium",
    tags: [],
    custom_fields: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as PmTask;
}

const active = makeProject({ id: "p-active", status: "active" });
const retired = makeProject({ id: "p-retired", status: "complete" });
const archived = makeProject({ id: "p-archived", status: "archived" });
const projById = new Map<string, PmProject>([
  [active.id, active],
  [retired.id, retired],
  [archived.id, archived],
]);

const openTask = makeTask({ id: "t-open", project_id: active.id, status: "in_progress" });
const recentDone = makeTask({
  id: "t-recent",
  project_id: active.id,
  status: "complete",
  status_changed_at: "2026-09-10T01:00:00.000Z", // 14h ago
});
const oldDone = makeTask({
  id: "t-old",
  project_id: active.id,
  status: "complete",
  status_changed_at: "2026-09-01T01:00:00.000Z", // >48h ago
});
const approvedOld = makeTask({
  id: "t-approved",
  project_id: active.id,
  status: "approved",
  status_changed_at: "2026-09-01T01:00:00.000Z",
});
const openOnRetired = makeTask({
  id: "t-orphan",
  project_id: retired.id,
  status: "in_progress",
});
const doneFallbackUpdated = makeTask({
  id: "t-fallback",
  project_id: active.id,
  status: "complete",
  status_changed_at: null,
  updated_at: "2026-09-10T10:00:00.000Z", // within window via updated_at
});
const doneFallbackOld = makeTask({
  id: "t-fallback-old",
  project_id: active.id,
  status: "complete",
  status_changed_at: null,
  updated_at: "2026-08-01T10:00:00.000Z",
});

const allTasks = [
  openTask,
  recentDone,
  oldDone,
  approvedOld,
  openOnRetired,
  doneFallbackUpdated,
  doneFallbackOld,
];

describe("RETIRED_PROJECT_STATUSES / isRetiredProject", () => {
  it("includes complete, archived, cancelled", () => {
    expect(RETIRED_PROJECT_STATUSES.has("complete")).toBe(true);
    expect(RETIRED_PROJECT_STATUSES.has("archived")).toBe(true);
    expect(RETIRED_PROJECT_STATUSES.has("cancelled")).toBe(true);
    expect(RETIRED_PROJECT_STATUSES.has("active")).toBe(false);
  });

  it("detects retired projects", () => {
    expect(isRetiredProject(active)).toBe(false);
    expect(isRetiredProject(retired)).toBe(true);
    expect(isRetiredProject(archived)).toBe(true);
    expect(isRetiredProject(undefined)).toBe(false);
  });
});

describe("isRecentlyDone", () => {
  it("returns true for done tasks inside the grace window", () => {
    expect(isRecentlyDone(recentDone, now)).toBe(true);
    expect(isRecentlyDone(doneFallbackUpdated, now)).toBe(true);
  });

  it("returns false for done tasks outside the window", () => {
    expect(isRecentlyDone(oldDone, now)).toBe(false);
    expect(isRecentlyDone(doneFallbackOld, now)).toBe(false);
  });

  it("returns false for open tasks", () => {
    expect(isRecentlyDone(openTask, now)).toBe(false);
  });

  it("uses status_changed_at over updated_at when both present", () => {
    const mixed = makeTask({
      id: "t-mixed",
      project_id: active.id,
      status: "complete",
      status_changed_at: "2026-09-01T01:00:00.000Z",
      updated_at: "2026-09-10T14:00:00.000Z",
    });
    expect(isRecentlyDone(mixed, now)).toBe(false);
  });

  it("exposes a 48-hour window constant", () => {
    expect(RECENTLY_DONE_WINDOW_HOURS).toBe(48);
  });
});

describe("applyWorkScope", () => {
  it("all: returns every task unfiltered", () => {
    expect(applyWorkScope(allTasks, "all", projById, now)).toEqual(allTasks);
  });

  it("completed: only done tasks (includes retired-project tasks if done)", () => {
    const result = applyWorkScope(allTasks, "completed", projById, now);
    expect(result.map(t => t.id).sort()).toEqual(
      ["t-approved", "t-fallback", "t-fallback-old", "t-old", "t-recent"].sort(),
    );
  });

  it("open: keeps open tasks on active projects", () => {
    const result = applyWorkScope(allTasks, "open", projById, now);
    expect(result.some(t => t.id === "t-open")).toBe(true);
  });

  it("open: keeps recently done tasks inside the grace window", () => {
    const result = applyWorkScope(allTasks, "open", projById, now);
    expect(result.some(t => t.id === "t-recent")).toBe(true);
    expect(result.some(t => t.id === "t-fallback")).toBe(true);
  });

  it("open: drops done tasks outside the grace window", () => {
    const result = applyWorkScope(allTasks, "open", projById, now);
    expect(result.some(t => t.id === "t-old")).toBe(false);
    expect(result.some(t => t.id === "t-approved")).toBe(false);
    expect(result.some(t => t.id === "t-fallback-old")).toBe(false);
  });

  it("open: drops tasks on retired projects even if still open", () => {
    const result = applyWorkScope(allTasks, "open", projById, now);
    expect(result.some(t => t.id === "t-orphan")).toBe(false);
  });

  it("open: falls back to updated_at when status_changed_at is null", () => {
    const result = applyWorkScope([doneFallbackUpdated, doneFallbackOld], "open", projById, now);
    expect(result.map(t => t.id)).toEqual(["t-fallback"]);
  });
});

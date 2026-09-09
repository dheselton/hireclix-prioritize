import { describe, expect, it } from "vitest";
import {
  defaultHandoffDecisions,
  handoffToastMessage,
  openBuildTasks,
  summarizeHandoffDecisions,
} from "@/lib/pm/supportHandoff";
import { projectWorkCardGroups } from "@/components/pm/collections/ProjectWorkGrid";
import type { PmProject, PmTask } from "@/types/pm";

function task(partial: Partial<PmTask> & { id: string; project_id: string; status: PmTask["status"] }): PmTask {
  return {
    title: partial.title ?? partial.id,
    type: "design",
    priority: "medium",
    tags: [],
    sort_order: 0,
    custom_fields: {},
    design_round: null,
    design_approval: null,
    dev_blocker: null,
    description: null,
    assignee_id: null,
    created_by: null,
    due_date: null,
    start_date: null,
    duration_days: 1,
    phase_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  } as PmTask;
}

function project(partial: Partial<PmProject> & { id: string }): PmProject {
  return {
    title: partial.title ?? partial.id,
    client_id: null,
    type: "career_site",
    work_type: "project",
    status: "active",
    go_live_date: null,
    start_date: null,
    kickoff_date: null,
    description: null,
    tags: [],
    template_id: null,
    created_by: null,
    custom_fields: {},
    created_at: "",
    updated_at: "",
    ...partial,
  } as PmProject;
}

describe("openBuildTasks / handoff defaults", () => {
  it("filters done statuses and defaults to complete", () => {
    const tasks = [
      task({ id: "a", project_id: "p1", status: "in_progress" }),
      task({ id: "b", project_id: "p1", status: "complete" }),
      task({ id: "c", project_id: "p1", status: "approved" }),
      task({ id: "d", project_id: "p1", status: "claimed" }),
    ];
    expect(openBuildTasks(tasks).map((t) => t.id)).toEqual(["a", "d"]);
    expect(defaultHandoffDecisions(tasks)).toEqual([
      { taskId: "a", action: "complete" },
      { taskId: "d", action: "complete" },
    ]);
  });

  it("summarizes decisions and toast copy", () => {
    const summary = summarizeHandoffDecisions([
      { taskId: "1", action: "complete" },
      { taskId: "2", action: "convert" },
      { taskId: "3", action: "keep" },
      { taskId: "4", action: "complete" },
    ]);
    expect(summary).toEqual({ completed: 2, converted: 1, kept: 1 });
    expect(handoffToastMessage(summary, true)).toContain("Live Career Site");
    expect(handoffToastMessage(summary, true)).toContain("2 completed");
    expect(handoffToastMessage(summary, false)).toBe("2 completed · 1 converted to Support · 1 kept open");
  });
});

describe("projectWorkCardGroups", () => {
  it("hides Support-mode projects from cards but keeps unknown projects as loose", () => {
    const live = project({
      id: "live",
      title: "Resideo",
      custom_fields: { support_mode_at: "2026-08-07T00:00:00Z" },
    });
    const build = project({ id: "build", title: "CHS" });
    const projects = new Map([["live", live], ["build", build]]);
    const tasks = [
      task({ id: "t1", project_id: "live", status: "in_progress", title: "Leftover" }),
      task({ id: "t2", project_id: "build", status: "claimed", title: "Active" }),
      task({ id: "t3", project_id: "missing", status: "unclaimed", title: "Orphan" }),
    ];
    const { list, loose } = projectWorkCardGroups(tasks, projects);
    expect(list.map((g) => g.project.id)).toEqual(["build"]);
    expect(list[0].tasks.map((t) => t.id)).toEqual(["t2"]);
    // Live-site leftover tasks are omitted from cards (not loose) — findable in list/kanban.
    expect(loose.map((t) => t.id)).toEqual(["t3"]);
  });
});

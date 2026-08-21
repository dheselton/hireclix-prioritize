import { describe, expect, it } from "vitest";
import { projectFilterLink, projectTimeLink } from "./links";
import { canSeeProjectTimeTotal } from "./projectTime";
import { labelProjectActivity } from "./projectActivity";
import type { ProjectFileRow } from "./projectAttachments";

describe("projectFilterLink", () => {
  it("defaults to the Tasks tab", () => {
    expect(projectFilterLink("abc")).toBe("/pm/projects/abc?tab=tasks");
  });

  it("includes taskFilter when provided", () => {
    expect(projectFilterLink("abc", "overdue")).toBe(
      "/pm/projects/abc?tab=tasks&taskFilter=overdue",
    );
  });
});

describe("projectTimeLink", () => {
  it("points at the timesheet with a project query", () => {
    expect(projectTimeLink("proj-1")).toBe("/pm/time?project=proj-1");
  });
});

describe("canSeeProjectTimeTotal", () => {
  it("allows PM and BA only", () => {
    expect(canSeeProjectTimeTotal("pm")).toBe(true);
    expect(canSeeProjectTimeTotal("ba")).toBe(true);
    expect(canSeeProjectTimeTotal(["pm", "designer"])).toBe(true);
    expect(canSeeProjectTimeTotal("designer")).toBe(false);
    expect(canSeeProjectTimeTotal("developer")).toBe(false);
    expect(canSeeProjectTimeTotal("submitter")).toBe(false);
  });
});

describe("labelProjectActivity", () => {
  it("maps known actions and falls back cleanly", () => {
    expect(labelProjectActivity("project.go_live_changed")).toBe("updated go-live");
    expect(labelProjectActivity("task.created", { title: "Wireframes" })).toBe("created a task");
    expect(labelProjectActivity("custom.thing", { title: "X" })).toBe("thing: X");
  });
});

describe("project attachment merge ordering", () => {
  it("sorts newest first across project and task sources", () => {
    const rows: ProjectFileRow[] = [
      {
        id: "1", type: "file", name: "old.pdf", url: "/a", label: null, file_size: 1,
        uploaded_by: null, created_at: "2026-01-01T00:00:00Z", task_id: null, is_project_level: true,
      },
      {
        id: "2", type: "file", name: "new.png", url: "/b", label: null, file_size: 1,
        uploaded_by: null, created_at: "2026-08-01T00:00:00Z", task_id: "t1", is_project_level: false,
      },
      {
        id: "3", type: "link", name: "mid", url: "/c", label: null, file_size: null,
        uploaded_by: null, created_at: "2026-06-01T00:00:00Z", task_id: null, is_project_level: true,
      },
    ];
    const sorted = [...rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    expect(sorted.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });
});

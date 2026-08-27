import { describe, expect, it } from "vitest";
import { dedupeRequestProjects, requestProjectsFromInboxRows } from "./requestAdmin";
import type { PmProject } from "@/types/pm";

describe("requestAdmin", () => {
  it("dedupes selected rows to unique request projects only", () => {
    const rows = [
      { projectId: "p1", workType: "request", title: "Fix login" },
      { projectId: "p1", workType: "request", title: "Fix login" },
      { projectId: "p2", workType: "request", title: "Update banner" },
      { projectId: "p3", workType: "project", title: "Website relaunch" },
      { projectId: "_no_project", workType: "request", title: "Orphan" },
    ];
    expect(dedupeRequestProjects(rows)).toEqual([
      { projectId: "p1", workType: "request", title: "Fix login" },
      { projectId: "p2", workType: "request", title: "Update banner" },
    ]);
  });

  it("maps inbox rows to request projects", () => {
    const projectA = { id: "p1", title: "A", work_type: "request" } as PmProject;
    const projectB = { id: "p2", title: "B", work_type: "project" } as PmProject;
    expect(requestProjectsFromInboxRows([
      { project: projectA },
      { project: projectA },
      { project: projectB },
      { project: undefined },
    ])).toEqual([
      { projectId: "p1", workType: "request", title: "A" },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  isSiteInitiativeProject,
  siteInitiativeKind,
  summarizeInitiativeItems,
} from "@/lib/pm/siteInitiatives";

describe("isSiteInitiativeProject", () => {
  it("detects site_initiative flag", () => {
    expect(isSiteInitiativeProject({ custom_fields: { site_initiative: true, kind: "feature" } })).toBe(true);
    expect(isSiteInitiativeProject({ custom_fields: { support_mode_at: "2026-01-01" } })).toBe(false);
    expect(isSiteInitiativeProject(null)).toBe(false);
  });
});

describe("siteInitiativeKind", () => {
  it("returns maintenance or feature", () => {
    expect(siteInitiativeKind({ custom_fields: { site_initiative: true, kind: "maintenance" } })).toBe("maintenance");
    expect(siteInitiativeKind({ custom_fields: { site_initiative: true, kind: "feature" } })).toBe("feature");
    expect(siteInitiativeKind({ custom_fields: {} })).toBe(null);
  });
});

describe("summarizeInitiativeItems", () => {
  it("rolls up status buckets", () => {
    expect(
      summarizeInitiativeItems(["closed", "closed", "in_progress", "needs_triage", "waiting"]),
    ).toEqual({
      sites: 5,
      completed: 2,
      inProgress: 1,
      blocked: 1,
      needsTriage: 1,
    });
  });
});

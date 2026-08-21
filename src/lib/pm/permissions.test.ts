import { describe, expect, it } from "vitest";
import { blockedRoutePrefixes, canSee, fallbackPath, toRoles } from "./permissions";

describe("permissions mobile role matrix", () => {
  it("defaults empty roles to pm", () => {
    expect(toRoles(null)).toEqual(["pm"]);
    expect(toRoles([])).toEqual(["pm"]);
  });

  it("submitter-only is blocked from work board and staff surfaces", () => {
    const blocked = blockedRoutePrefixes("submitter");
    expect(blocked).toEqual(expect.arrayContaining([
      "/pm/inbox",
      "/pm/report",
      "/pm/clients",
      "/pm/templates",
      "/pm/integrations",
      "/pm/work",
    ]));
    expect(fallbackPath("submitter")).toBe("/pm/my-work");
    expect(canSee("submitter", "myWork")).toBe(true);
    expect(canSee("submitter", "taskWorkspace")).toBe(true);
    expect(canSee("submitter", "projectDetail")).toBe(true);
  });

  it("designer can see work/snippets but not inbox/clients", () => {
    expect(canSee("designer", "work")).toBe(true);
    expect(canSee("designer", "snippets")).toBe(true);
    expect(canSee("designer", "inbox")).toBe(false);
    expect(canSee("designer", "clients")).toBe(false);
    expect(blockedRoutePrefixes("designer")).toEqual(expect.arrayContaining([
      "/pm/inbox",
      "/pm/clients",
      "/pm/report",
    ]));
    expect(fallbackPath("designer")).toBe("/");
  });

  it("tech_lead is blocked from inbox/report/clients/authoring", () => {
    const blocked = blockedRoutePrefixes("tech_lead");
    expect(blocked).toEqual(expect.arrayContaining([
      "/pm/inbox",
      "/pm/report",
      "/pm/clients",
      "/pm/templates",
      "/pm/integrations",
    ]));
    expect(canSee("tech_lead", "work")).toBe(true);
    expect(canSee("tech_lead", "timeline")).toBe(true);
  });

  it("multi-role PM+designer sees union of surfaces", () => {
    expect(canSee(["pm", "designer"], "inbox")).toBe(true);
    expect(canSee(["pm", "designer"], "snippets")).toBe(true);
    expect(blockedRoutePrefixes(["pm", "designer"])).toEqual([]);
  });
});

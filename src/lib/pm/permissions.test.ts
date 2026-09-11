import { describe, expect, it } from "vitest";
import {
  blockedRoutePrefixes,
  briefingScope,
  canCreateWork,
  canManageClientWork,
  canPostClientVisible,
  canSee,
  fallbackPath,
  isOperator,
  isSubmitterOnly,
  timesheetScope,
  toRoles,
} from "./permissions";

describe("permissions mobile role matrix", () => {
  it("defaults empty roles to deny (empty list)", () => {
    expect(toRoles(null)).toEqual([]);
    expect(toRoles([])).toEqual([]);
    expect(canSee(null, "inbox")).toBe(false);
    expect(canSee([], "myWork")).toBe(false);
  });

  it("submitter-only can discover shared client work but not manage staff surfaces", () => {
    const blocked = blockedRoutePrefixes("submitter");
    expect(blocked).toEqual(expect.arrayContaining([
      "/pm/inbox",
      "/pm/report",
      "/pm/templates",
      "/pm/integrations",
      "/pm/team",
      "/roadmap",
    ]));
    expect(fallbackPath("submitter")).toBe("/pm/my-work");
    expect(canSee("submitter", "myWork")).toBe(true);
    expect(canSee("submitter", "taskWorkspace")).toBe(true);
    expect(canSee("submitter", "projectDetail")).toBe(true);
    expect(canSee("submitter", "clients")).toBe(true);
    expect(canSee("submitter", "work")).toBe(true);
    expect(canSee("submitter", "profile")).toBe(true);
    expect(canSee("submitter", "notifications")).toBe(true);
    expect(canSee("submitter", "settings")).toBe(true);
    expect(isSubmitterOnly("submitter")).toBe(true);
    expect(isSubmitterOnly(["submitter", "pm"])).toBe(false);
  });

  it("designer can see work/snippets/clients but not inbox", () => {
    expect(canSee("designer", "work")).toBe(true);
    expect(canSee("designer", "snippets")).toBe(true);
    expect(canSee("designer", "clients")).toBe(true);
    expect(canSee("designer", "inbox")).toBe(false);
    expect(blockedRoutePrefixes("designer")).toEqual(expect.arrayContaining([
      "/pm/inbox",
      "/pm/report",
      "/pm/team",
      "/roadmap",
    ]));
    expect(blockedRoutePrefixes("designer")).not.toEqual(expect.arrayContaining(["/pm/clients"]));
    expect(fallbackPath("designer")).toBe("/");
  });

  it("tech_lead is blocked from inbox/report/authoring but can see clients", () => {
    const blocked = blockedRoutePrefixes("tech_lead");
    expect(blocked).toEqual(expect.arrayContaining([
      "/pm/inbox",
      "/pm/report",
      "/pm/templates",
      "/pm/forms/",
      "/pm/integrations",
      "/pm/team",
      "/roadmap",
    ]));
    expect(blocked).not.toEqual(expect.arrayContaining(["/pm/clients"]));
    expect(canSee("tech_lead", "work")).toBe(true);
    expect(canSee("tech_lead", "timeline")).toBe(true);
    expect(canSee("tech_lead", "clients")).toBe(true);
  });

  it("multi-role PM+designer sees union of surfaces", () => {
    expect(canSee(["pm", "designer"], "inbox")).toBe(true);
    expect(canSee(["pm", "designer"], "snippets")).toBe(true);
    expect(blockedRoutePrefixes(["pm", "designer"])).toEqual([]);
  });

  it("multi-role designer+developer sees union", () => {
    expect(canSee(["designer", "developer"], "snippets")).toBe(true);
    expect(canSee(["designer", "developer"], "vendors")).toBe(true);
    expect(canSee(["designer", "developer"], "inbox")).toBe(false);
  });

  it("submitter+PM is not submitter-only and sees operator surfaces", () => {
    expect(isSubmitterOnly(["submitter", "pm"])).toBe(false);
    expect(canSee(["submitter", "pm"], "inbox")).toBe(true);
    expect(canSee(["submitter", "pm"], "team")).toBe(true);
    expect(blockedRoutePrefixes(["submitter", "pm"])).toEqual([]);
  });

  it("loomLibrary is limited to creative production roles", () => {
    expect(canSee("designer", "loomLibrary")).toBe(true);
    expect(canSee("developer", "loomLibrary")).toBe(true);
    expect(canSee("tech_lead", "loomLibrary")).toBe(true);
    expect(canSee("pm", "loomLibrary")).toBe(false);
    expect(canSee("ba", "loomLibrary")).toBe(false);
    expect(canSee("submitter", "loomLibrary")).toBe(false);
    expect(canSee(["pm", "designer"], "loomLibrary")).toBe(true);
    expect(canSee(["pm", "ba"], "loomLibrary")).toBe(false);
  });

  it("admin overlay sees every surface including loomLibrary and team", () => {
    expect(canSee("developer", "team", { isAdmin: true })).toBe(true);
    expect(canSee("developer", "inbox", { isAdmin: true })).toBe(true);
    expect(canSee("developer", "snippets", { isAdmin: true })).toBe(true);
    expect(canSee("developer", "loomLibrary", { isAdmin: true })).toBe(true);
    expect(blockedRoutePrefixes("developer", { isAdmin: true })).toEqual([]);
    expect(canPostClientVisible("developer", { isAdmin: true })).toBe(true);
    expect(briefingScope("developer", { isAdmin: true })).toBe("team");
    expect(timesheetScope("developer", { isAdmin: true })).toBe("team-toggle");
  });

  it("admin-only (no jobs) still sees everything via overlay", () => {
    expect(canSee([], "team", { isAdmin: true })).toBe(true);
    expect(canSee([], "snippets", { isAdmin: true })).toBe(true);
    expect(isOperator([], { isAdmin: true })).toBe(true);
  });

  it("isOperator is PM/BA or admin", () => {
    expect(isOperator("pm")).toBe(true);
    expect(isOperator("ba")).toBe(true);
    expect(isOperator("designer")).toBe(false);
    expect(isOperator("designer", { isAdmin: true })).toBe(true);
    expect(isOperator(["designer", "pm"])).toBe(true);
  });

  it("uses one creation capability for projects and Quick Requests", () => {
    expect(canCreateWork("designer")).toBe(true);
    expect(canCreateWork(["submitter", "developer"])).toBe(true);
    expect(canCreateWork("submitter")).toBe(false);
    expect(canCreateWork([], { isAdmin: true })).toBe(true);
  });

  it("limits project-level management to operators", () => {
    expect(canManageClientWork("pm")).toBe(true);
    expect(canManageClientWork("ba")).toBe(true);
    expect(canManageClientWork("developer")).toBe(false);
  });
});

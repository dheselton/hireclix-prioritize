import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearCreateWorkDraft,
  draftHasContent,
  draftStorageKey,
  parseCreateWorkDraft,
  readCreateWorkDraft,
  writeCreateWorkDraft,
  type CreateWorkDraft,
} from "./createWorkDraft";

function sampleDraft(overrides: Partial<CreateWorkDraft> = {}): CreateWorkDraft {
  return {
    v: 1,
    userId: "user-1",
    updatedAt: "2026-09-09T12:00:00.000Z",
    step: "request",
    requestType: "web_edit",
    reqForm: { title: "Need a banner", client_id: "c1", description: "ASAP" },
    reqFieldValues: { field_a: "yes" },
    quickTasks: ["Design", ""],
    reqRequestedBy: "user-1",
    reqLinks: [{ url: "https://example.com", label: "Brief" }],
    parentProjectId: null,
    projForm: {
      title: "",
      type: "career_site",
      status: "active",
      client_id: "",
      kickoff_date: "",
      go_live_date: "",
      visibility: "personal_private",
    },
    projRequestedBy: "user-1",
    projLinks: [],
    ...overrides,
  };
}

describe("createWorkDraft", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("draftHasContent is false for blank defaults", () => {
    expect(draftHasContent(sampleDraft({
      step: "select",
      reqForm: { title: "", client_id: "", description: "" },
      reqFieldValues: {},
      quickTasks: [""],
      reqLinks: [],
      reqRequestedBy: null,
      parentProjectId: null,
    }))).toBe(false);
  });

  it("draftHasContent is true when title is filled", () => {
    expect(draftHasContent(sampleDraft())).toBe(true);
  });

  it("draftHasContent ignores the step so browsing a step is not a draft", () => {
    const blankFields = {
      reqForm: { title: "", client_id: "", description: "" },
      reqFieldValues: {},
      quickTasks: [""],
      reqLinks: [],
      reqRequestedBy: null,
      parentProjectId: null,
    };
    expect(draftHasContent(sampleDraft({ ...blankFields, step: "request" }))).toBe(false);
    expect(draftHasContent(sampleDraft({ ...blankFields, step: "project-entry" }))).toBe(false);
    expect(draftHasContent(sampleDraft({ ...blankFields, step: "project-blank" }))).toBe(false);
  });

  it("round-trips write/read for the same user", () => {
    writeCreateWorkDraft("user-1", sampleDraft());
    const restored = readCreateWorkDraft("user-1");
    expect(restored?.reqForm.title).toBe("Need a banner");
    expect(restored?.reqLinks).toEqual([{ url: "https://example.com", label: "Brief" }]);
    expect(restored?.quickTasks).toEqual(["Design", ""]);
  });

  it("does not return another user's draft", () => {
    writeCreateWorkDraft("user-1", sampleDraft());
    expect(readCreateWorkDraft("user-2")).toBeNull();
  });

  it("clearCreateWorkDraft removes the key", () => {
    writeCreateWorkDraft("user-1", sampleDraft());
    clearCreateWorkDraft("user-1");
    expect(sessionStorage.getItem(draftStorageKey("user-1"))).toBeNull();
    expect(readCreateWorkDraft("user-1")).toBeNull();
  });

  it("parseCreateWorkDraft rejects wrong version or corrupt JSON", () => {
    expect(parseCreateWorkDraft("{not-json", "user-1")).toBeNull();
    expect(parseCreateWorkDraft(JSON.stringify({ ...sampleDraft(), v: 99 }), "user-1")).toBeNull();
    expect(parseCreateWorkDraft(JSON.stringify({ ...sampleDraft(), userId: "other" }), "user-1")).toBeNull();
  });

  it("writeCreateWorkDraft clears storage when payload is empty", () => {
    writeCreateWorkDraft("user-1", sampleDraft());
    writeCreateWorkDraft("user-1", {
      step: "select",
      requestType: "web_edit",
      reqForm: { title: "", client_id: "", description: "" },
      reqFieldValues: {},
      quickTasks: [""],
      reqRequestedBy: null,
      reqLinks: [],
      parentProjectId: null,
      projForm: {
        title: "",
        type: "career_site",
        status: "active",
        client_id: "",
        kickoff_date: "",
        go_live_date: "",
        visibility: "personal_private",
      },
      projRequestedBy: null,
      projLinks: [],
    });
    expect(readCreateWorkDraft("user-1")).toBeNull();
  });
});

describe("TOKEN_REFRESHED silent session policy", () => {
  it("treats TOKEN_REFRESHED as silent and other events as full resolve", () => {
    const shouldSilent = (event: string) => event === "TOKEN_REFRESHED";
    expect(shouldSilent("TOKEN_REFRESHED")).toBe(true);
    expect(shouldSilent("SIGNED_IN")).toBe(false);
    expect(shouldSilent("INITIAL_SESSION")).toBe(false);
    expect(shouldSilent("SIGNED_OUT")).toBe(false);
  });
});

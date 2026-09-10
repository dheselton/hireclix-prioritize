import { describe, expect, it } from "vitest";
import {
  isCareerSiteRequestType,
  shouldShowInUnlinkedList,
} from "@/lib/pm/requestCorrections";

describe("isCareerSiteRequestType", () => {
  it("matches careersite_ prefix", () => {
    expect(isCareerSiteRequestType("careersite_bug")).toBe(true);
    expect(isCareerSiteRequestType("careersite_content")).toBe(true);
    expect(isCareerSiteRequestType("web_edit")).toBe(false);
    expect(isCareerSiteRequestType(null)).toBe(false);
    expect(isCareerSiteRequestType(undefined)).toBe(false);
  });
});

describe("shouldShowInUnlinkedList", () => {
  it("includes open unlinked careersite requests", () => {
    expect(
      shouldShowInUnlinkedList({
        work_type: "request",
        status: "active",
        parent_project_id: null,
        custom_fields: { request_type: "careersite_bug" },
      }),
    ).toBe(true);
  });

  it("excludes non-careersite, linked, complete, and non-request rows", () => {
    expect(
      shouldShowInUnlinkedList({
        work_type: "request",
        status: "active",
        parent_project_id: null,
        custom_fields: { request_type: "web_edit" },
      }),
    ).toBe(false);
    expect(
      shouldShowInUnlinkedList({
        work_type: "request",
        status: "active",
        parent_project_id: null,
        custom_fields: { request_type: "dev_spike" },
      }),
    ).toBe(false);
    expect(
      shouldShowInUnlinkedList({
        work_type: "request",
        status: "active",
        parent_project_id: "site-1",
        custom_fields: { request_type: "careersite_bug" },
      }),
    ).toBe(false);
    expect(
      shouldShowInUnlinkedList({
        work_type: "request",
        status: "complete",
        parent_project_id: null,
        custom_fields: { request_type: "careersite_bug" },
      }),
    ).toBe(false);
    expect(
      shouldShowInUnlinkedList({
        work_type: "project",
        status: "active",
        parent_project_id: null,
        custom_fields: { request_type: "careersite_bug" },
      }),
    ).toBe(false);
  });
});

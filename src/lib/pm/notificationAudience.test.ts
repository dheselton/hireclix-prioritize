import { describe, expect, it } from "vitest";
import {
  isCreativeProductionRecipient,
  isCreativeProductionRequest,
} from "./notificationAudience";

describe("isCreativeProductionRequest", () => {
  it("includes career site support and web/backend types", () => {
    expect(isCreativeProductionRequest("careersite_support")).toBe(true);
    expect(isCreativeProductionRequest("careersite_jobfeed")).toBe(true);
    expect(isCreativeProductionRequest("web_edit")).toBe(true);
    expect(isCreativeProductionRequest("banner_ads")).toBe(true);
  });

  it("excludes general/other", () => {
    expect(isCreativeProductionRequest("general")).toBe(false);
    expect(isCreativeProductionRequest(null)).toBe(false);
  });
});

describe("isCreativeProductionRecipient", () => {
  it("includes designers, developers, Lisa, and Dan", () => {
    expect(isCreativeProductionRecipient({ role: "designer", roles: ["designer"], email: "jill@x.com", is_active: true })).toBe(true);
    expect(isCreativeProductionRecipient({ role: "developer", roles: ["developer"], email: "riley@x.com", is_active: true })).toBe(true);
    expect(isCreativeProductionRecipient({ role: "designer", roles: ["designer", "developer"], email: "lisa.thompson@hireclix.com", is_active: true })).toBe(true);
    expect(isCreativeProductionRecipient({ role: "pm", roles: ["pm", "designer", "developer"], email: "dan.heselton@hireclix.com", is_active: true })).toBe(true);
  });

  it("excludes PM-only staff", () => {
    expect(isCreativeProductionRecipient({ role: "pm", roles: ["pm"], email: "drew.luster@hireclix.com", is_active: true })).toBe(false);
    expect(isCreativeProductionRecipient({ role: "pm", roles: ["pm"], email: "moe.hutt@hireclix.com", is_active: true })).toBe(false);
  });
});

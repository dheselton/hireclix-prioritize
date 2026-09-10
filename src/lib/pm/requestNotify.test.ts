import { describe, expect, it } from "vitest";
import { groupKeyForRequestType, isDevRequestType } from "./requestTypes";
import { extractMentionIds } from "./notifications";

describe("groupKeyForRequestType", () => {
  it("maps career site and ads slugs to groups", () => {
    expect(groupKeyForRequestType("careersite_new_page")).toBe("career_site");
    expect(groupKeyForRequestType("careersite_update")).toBe("career_site");
    expect(groupKeyForRequestType("banner_ads")).toBe("ads");
    expect(groupKeyForRequestType("unknown")).toBe("other");
    expect(groupKeyForRequestType(null)).toBe("other");
  });

  it("maps dev house-account slugs to the dev group", () => {
    expect(groupKeyForRequestType("dev_api")).toBe("dev");
    expect(groupKeyForRequestType("dev_reporting")).toBe("dev");
    expect(groupKeyForRequestType("dev_spike")).toBe("dev");
  });
});

describe("isDevRequestType", () => {
  it("matches dev_ prefix", () => {
    expect(isDevRequestType("dev_api")).toBe(true);
    expect(isDevRequestType("dev_platform")).toBe(true);
    expect(isDevRequestType("careersite_bug")).toBe(false);
    expect(isDevRequestType("general")).toBe(false);
    expect(isDevRequestType(null)).toBe(false);
  });
});

describe("extractMentionIds", () => {
  it("returns only newly relevant ids from data-mention-id", () => {
    const html = `<p><span data-mention-id="aaa">@Jill</span> and <span data-mention-id='bbb'>@Dan</span></p>`;
    expect(extractMentionIds(html).sort()).toEqual(["aaa", "bbb"]);
    expect(extractMentionIds("plain")).toEqual([]);
  });
});

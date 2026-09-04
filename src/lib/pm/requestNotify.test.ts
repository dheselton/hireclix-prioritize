import { describe, expect, it } from "vitest";
import { groupKeyForRequestType } from "./requestTypes";
import { extractMentionIds } from "./notifications";

describe("groupKeyForRequestType", () => {
  it("maps career site and ads slugs to groups", () => {
    expect(groupKeyForRequestType("careersite_new_page")).toBe("career_site");
    expect(groupKeyForRequestType("careersite_update")).toBe("career_site");
    expect(groupKeyForRequestType("banner_ads")).toBe("ads");
    expect(groupKeyForRequestType("unknown")).toBe("other");
    expect(groupKeyForRequestType(null)).toBe("other");
  });
});

describe("extractMentionIds", () => {
  it("returns only newly relevant ids from data-mention-id", () => {
    const html = `<p><span data-mention-id="aaa">@Jill</span> and <span data-mention-id='bbb'>@Dan</span></p>`;
    expect(extractMentionIds(html).sort()).toEqual(["aaa", "bbb"]);
    expect(extractMentionIds("plain")).toEqual([]);
  });
});

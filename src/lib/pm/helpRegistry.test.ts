import { describe, expect, it } from "vitest";
import {
  defaultPackId,
  findGuide,
  packsForRoles,
  parseGuideParam,
  visibleGuides,
  getPack,
} from "./helpRegistry";

describe("helpRegistry", () => {
  it("defaults submitter-only to submitter pack", () => {
    expect(defaultPackId(["submitter"])).toBe("submitter");
  });

  it("defaults pm/ba to operators", () => {
    expect(defaultPackId(["pm"])).toBe("operators");
    expect(defaultPackId(["ba", "designer"])).toBe("operators");
  });

  it("defaults designer/developer to production", () => {
    expect(defaultPackId(["designer"])).toBe("production");
    expect(defaultPackId(["developer"])).toBe("production");
  });

  it("lists submitter pack first for submitter-only", () => {
    const packs = packsForRoles(["submitter"]);
    expect(packs[0].id).toBe("submitter");
  });

  it("hides operator-only guides when filtering by surface for designer", () => {
    const pack = getPack("operators");
    const guides = visibleGuides(pack, ["designer"]);
    expect(guides.some((g) => g.slug === "operators/team-and-access")).toBe(false);
    expect(guides.some((g) => g.slug === "_shared/glossary")).toBe(true);
  });

  it("parses ?guide= slugs", () => {
    expect(parseGuideParam("operators/your-day")).toEqual({
      packId: "operators",
      slug: "operators/your-day",
    });
    expect(findGuide("_shared/glossary")?.pack.id).toBe("operators");
  });
});

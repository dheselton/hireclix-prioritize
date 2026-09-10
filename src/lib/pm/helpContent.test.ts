import { describe, expect, it } from "vitest";
import { HELP_PACKS } from "./helpRegistry";
import { getGuideMarkdown, listLoadedGuideSlugs } from "./helpContent";

describe("helpContent", () => {
  it("loads every registered guide slug from docs/guides", () => {
    const registered = new Set(HELP_PACKS.flatMap((p) => p.guides.map((g) => g.slug)));
    const loaded = new Set(listLoadedGuideSlugs().filter((s) => s !== "README"));
    for (const slug of registered) {
      expect(loaded.has(slug), `missing markdown for ${slug}`).toBe(true);
      expect(getGuideMarkdown(slug)?.length ?? 0).toBeGreaterThan(40);
    }
  });
});

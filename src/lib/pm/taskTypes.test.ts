import { describe, expect, it } from "vitest";
import { syncTypeTags, typesFromTask } from "./taskTypes";

describe("typesFromTask", () => {
  it("returns primary type only when no type tags", () => {
    expect(typesFromTask({ type: "dev", tags: ["qa", "feature:home"] })).toEqual(["dev"]);
  });

  it("includes secondary types from type:* tags", () => {
    expect(typesFromTask({ type: "dev", tags: ["type:qa", "type:design", "feature:x"] })).toEqual(["dev", "qa", "design"]);
  });

  it("ignores duplicate or primary type in tags", () => {
    expect(typesFromTask({ type: "dev", tags: ["type:dev", "type:qa"] })).toEqual(["dev", "qa"]);
  });
});

describe("syncTypeTags", () => {
  it("preserves non-type tags and rewrites type tags", () => {
    expect(syncTypeTags(["feature:a", "type:qa", "type:old"], ["design", "dev"])).toEqual([
      "feature:a",
      "type:dev",
    ]);
  });

  it("drops type tags when only primary remains", () => {
    expect(syncTypeTags(["type:qa", "qa"], ["dev"])).toEqual(["qa"]);
  });
});

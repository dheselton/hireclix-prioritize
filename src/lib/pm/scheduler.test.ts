import { describe, expect, it } from "vitest";
import { derivePlanGoLive } from "./scheduler";

describe("derivePlanGoLive", () => {
  it("uses the latest task due date in the current project plan", () => {
    expect(derivePlanGoLive([
      { due_date: "2026-10-02" },
      { due_date: null },
      { due_date: "2026-10-18" },
      { due_date: "2026-09-30" },
    ])).toBe("2026-10-18");
  });

  it("returns null when no task is scheduled", () => {
    expect(derivePlanGoLive([{ due_date: null }])).toBeNull();
  });
});

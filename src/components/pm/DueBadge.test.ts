import { describe, expect, it } from "vitest";
import { dueUrgency } from "@/components/pm/DueBadge";

describe("dueUrgency", () => {
  const today = "2026-08-21";

  it("classifies overdue, today, upcoming, and none", () => {
    expect(dueUrgency("2026-08-20", today)).toBe("overdue");
    expect(dueUrgency("2026-08-21", today)).toBe("today");
    expect(dueUrgency("2026-08-26", today)).toBe("upcoming");
    expect(dueUrgency(null, today)).toBe("none");
    expect(dueUrgency(undefined, today)).toBe("none");
    expect(dueUrgency("", today)).toBe("none");
  });
});

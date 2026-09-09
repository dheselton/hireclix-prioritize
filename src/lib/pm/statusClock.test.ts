import { describe, expect, it } from "vitest";
import {
  daysSince,
  projectStatusClockMeta,
  slippedNotificationBody,
  taskStatusClockMeta,
  waitingSortKey,
} from "@/lib/pm/statusClock";

const today = "2026-09-09";
const pastDue = "2026-08-14";
const statusAt = "2026-09-01T15:00:00.000Z";

describe("daysSince", () => {
  it("counts calendar days from timestamp", () => {
    expect(daysSince(statusAt, today)).toBe(8);
    expect(daysSince(null, today)).toBe(0);
  });
});

describe("taskStatusClockMeta", () => {
  it("returns status clock for slipped in_review work", () => {
    const meta = taskStatusClockMeta(
      { due_date: pastDue, status: "in_review", status_changed_at: statusAt },
      today,
    );
    expect(meta?.primary).toBe("In review · 8d");
    expect(meta?.secondary).toBe("Due Aug 14");
  });

  it("returns status clock for blocked in-progress past due", () => {
    const meta = taskStatusClockMeta(
      { due_date: pastDue, status: "blocked", status_changed_at: statusAt },
      today,
    );
    expect(meta?.primary).toBe("Blocked · 8d");
  });

  it("returns null for hard overdue (not started)", () => {
    expect(
      taskStatusClockMeta(
        { due_date: pastDue, status: "unclaimed", status_changed_at: statusAt },
        today,
      ),
    ).toBeNull();
  });

  it("returns null when not past due", () => {
    expect(
      taskStatusClockMeta(
        { due_date: "2026-09-20", status: "in_review", status_changed_at: statusAt },
        today,
      ),
    ).toBeNull();
  });
});

describe("projectStatusClockMeta", () => {
  it("returns on hold clock with due secondary", () => {
    const meta = projectStatusClockMeta(
      { dueDate: pastDue, status: "on_hold", status_changed_at: statusAt },
      today,
    );
    expect(meta?.primary).toBe("On hold · 8d");
    expect(meta?.secondary).toBe("Due Aug 14");
  });
});

describe("waitingSortKey", () => {
  it("sorts slipped work by longest status wait first", () => {
    const older = waitingSortKey(
      { dueDate: pastDue, status: "in_review", statusChangedAt: "2026-08-01T00:00:00Z" },
      today,
    );
    const newer = waitingSortKey(
      { dueDate: pastDue, status: "in_review", statusChangedAt: statusAt },
      today,
    );
    expect(older).toBeLessThan(newer);
  });
});

describe("slippedNotificationBody", () => {
  it("includes status clock and original due", () => {
    const body = slippedNotificationBody(
      { due_date: pastDue, status: "in_review", status_changed_at: statusAt },
      today,
    );
    expect(body).toContain("In review since Sep 1");
    expect(body).toContain("8 days");
    expect(body).toContain("original due Aug 14");
  });
});

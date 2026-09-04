import { describe, expect, it } from "vitest";
import {
  daysLate,
  dueAccentClass,
  dueState,
  isHardOverdue,
  isSlipped,
} from "@/lib/pm/dueState";
import type { TaskStatus } from "@/types/pm";

const today = "2026-09-03";
const past = "2026-08-28";
const future = "2026-09-10";

describe("dueState", () => {
  it("returns none when no due date", () => {
    expect(dueState({ due_date: null, status: "unclaimed" }, today)).toBe("none");
    expect(dueState({ status: "in_progress" }, today)).toBe("none");
  });

  it("returns settled for terminal statuses even when past due", () => {
    expect(dueState({ due_date: past, status: "complete" }, today)).toBe("settled");
    expect(dueState({ due_date: past, status: "approved" }, today)).toBe("settled");
  });

  it("returns overdue for unclaimed/claimed past due", () => {
    for (const status of ["unclaimed", "claimed"] as TaskStatus[]) {
      expect(dueState({ due_date: past, status }, today)).toBe("overdue");
      expect(isHardOverdue({ due_date: past, status }, today)).toBe(true);
      expect(isSlipped({ due_date: past, status }, today)).toBe(false);
    }
  });

  it("returns slipped for in_progress/in_review/blocked past due", () => {
    for (const status of ["in_progress", "in_review", "blocked"] as TaskStatus[]) {
      expect(dueState({ due_date: past, status }, today)).toBe("slipped");
      expect(isSlipped({ due_date: past, status }, today)).toBe(true);
      expect(isHardOverdue({ due_date: past, status }, today)).toBe(false);
    }
  });

  it("returns today / upcoming when not past due", () => {
    expect(dueState({ due_date: today, status: "unclaimed" }, today)).toBe("today");
    expect(dueState({ due_date: future, status: "in_progress" }, today)).toBe("upcoming");
  });

  it("treats missing status with past due as overdue", () => {
    expect(dueState({ due_date: past }, today)).toBe("overdue");
  });
});

describe("daysLate", () => {
  it("counts calendar days past due", () => {
    expect(daysLate(past, today)).toBe(6);
    expect(daysLate(today, today)).toBe(0);
    expect(daysLate(future, today)).toBe(0);
    expect(daysLate(null, today)).toBe(0);
  });
});

describe("dueAccentClass", () => {
  it("only accents hard overdue", () => {
    expect(dueAccentClass({ due_date: past, status: "unclaimed" }, today)).toContain("destructive");
    expect(dueAccentClass({ due_date: past, status: "in_progress" }, today)).toBe("");
    expect(dueAccentClass({ due_date: past, status: "complete" }, today)).toBe("");
  });
});

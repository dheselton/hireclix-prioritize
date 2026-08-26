import { describe, expect, it } from "vitest";
import { entryInterval, fmtEntryWhen, resolveTimeEntryTimestamps } from "./time";

describe("resolveTimeEntryTimestamps", () => {
  const now = new Date("2026-08-26T16:00:00");

  it("uses now as end when logging for today", () => {
    const ts = resolveTimeEntryTimestamps(30, "2026-08-26", now);
    expect(ts.ended_at).toBe(now.toISOString());
    expect(ts.started_at).toBe(new Date("2026-08-26T15:30:00").toISOString());
    expect(ts.logged_at).toBe(now.toISOString());
  });

  it("uses now as end when logged_at is omitted", () => {
    const ts = resolveTimeEntryTimestamps(60, undefined, now);
    expect(ts.ended_at).toBe(now.toISOString());
    expect(ts.started_at).toBe(new Date("2026-08-26T15:00:00").toISOString());
  });

  it("keeps date-only noon for past dates", () => {
    const ts = resolveTimeEntryTimestamps(60, "2026-08-25", now);
    expect(ts.logged_at).toBe("2026-08-25T12:00:00");
    expect(ts.started_at).toBeNull();
    expect(ts.ended_at).toBeNull();
  });

  it("passes through full ISO timestamps unchanged", () => {
    const iso = "2026-08-20T09:15:00.000Z";
    const ts = resolveTimeEntryTimestamps(15, iso, now);
    expect(ts.logged_at).toBe(iso);
    expect(ts.started_at).toBeNull();
    expect(ts.ended_at).toBeNull();
  });
});

describe("entryInterval display for manual today entries", () => {
  it("shows a clock range when started_at and ended_at are set", () => {
    const entry = {
      minutes: 30,
      logged_at: "2026-08-26T16:00:00.000Z",
      started_at: "2026-08-26T15:30:00.000Z",
      ended_at: "2026-08-26T16:00:00.000Z",
    };
    expect(entryInterval(entry)).not.toBeNull();
    expect(fmtEntryWhen(entry)).toMatch(/–/);
  });

  it("shows date only for past date-only entries", () => {
    const entry = {
      minutes: 60,
      logged_at: "2026-08-25T12:00:00",
      started_at: null,
      ended_at: null,
    };
    expect(entryInterval(entry)).toBeNull();
    expect(fmtEntryWhen(entry)).toMatch(/Aug 25$/);
  });
});

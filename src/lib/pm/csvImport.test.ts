import { describe, expect, it } from "vitest";
import { normalizeHeader, parseCsv, pickField, rowsToObjects } from "./csv";
import { looksLikeCsvHeader, parseQaCsv, parseTaskCsv } from "./csvImport";
import type { PmPhase, PmUser } from "@/types/pm";

describe("parseCsv", () => {
  it("handles quoted commas and newlines", () => {
    const rows = parseCsv('Title,Notes\n"Hello, world","Line1\nLine2"\nBare,ok\n');
    expect(rows).toEqual([
      ["Title", "Notes"],
      ["Hello, world", "Line1\nLine2"],
      ["Bare", "ok"],
    ]);
  });

  it("strips BOM", () => {
    expect(parseCsv("\uFEFFTitle\nA")[0][0]).toBe("Title");
  });
});

describe("header helpers", () => {
  it("normalizes header variants", () => {
    expect(normalizeHeader("Due Date")).toBe("duedate");
    expect(normalizeHeader("due_date")).toBe("duedate");
  });

  it("picks aliased fields", () => {
    const obj = rowsToObjects(parseCsv("Ticket,Sev\nBug,blocker"))[0];
    expect(pickField(obj, ["title", "ticket", "name"])).toBe("Bug");
    expect(pickField(obj, ["severity", "sev"])).toBe("blocker");
  });
});

describe("parseQaCsv", () => {
  it("maps severity aliases and defaults", () => {
    const csv = [
      "Title,Severity,Environment,Reporter",
      "A,critical,staging,Jane",
      "B,,,",
    ].join("\n");
    const rows = parseQaCsv(csv, { defaultSeverity: "minor", defaultEnvironment: "prod" });
    expect(rows[0]).toMatchObject({ title: "A", severity: "blocker", environment: "staging", reporter: "Jane" });
    expect(rows[1]).toMatchObject({ title: "B", severity: "minor", environment: "prod" });
  });

  it("detects header rows", () => {
    expect(looksLikeCsvHeader("Title,Severity\nX,major")).toBe(true);
    expect(looksLikeCsvHeader("Logo is blurry\nForm broken")).toBe(false);
  });
});

describe("parseTaskCsv", () => {
  const phases: PmPhase[] = [
    { id: "p1", project_id: "proj", name: "Design", sort_order: 0 },
  ];
  const users: PmUser[] = [
    {
      id: "u1",
      name: "Dan Heselton",
      email: "dan@hireclix.com",
      role: "pm",
      capacity_hours_per_week: 40,
      avatar_url: null,
    },
  ];

  it("resolves phase and assignee", () => {
    const csv = [
      "Title,Type,Priority,Phase,Assignee,Teams,Due date",
      "Hero,design,high,Design,dan@hireclix.com,Design,2026-09-05",
    ].join("\n");
    const rows = parseTaskCsv(csv, { phases, users });
    expect(rows[0]).toMatchObject({
      title: "Hero",
      type: "design",
      priority: "high",
      phaseId: "p1",
      assigneeId: "u1",
      dueDate: "2026-09-05",
    });
    expect(rows[0].error).toBeUndefined();
  });

  it("flags unknown assignee", () => {
    const csv = "Title,Assignee\nX,nobody@example.com\n";
    const rows = parseTaskCsv(csv, { phases, users });
    expect(rows[0].error).toMatch(/Unknown assignee/);
  });
});

import { describe, expect, it } from "vitest";
import {
  attributionPayload,
  creationSourceBadge,
  creationSourceLabel,
  formatAttribution,
  normalizeCreationSource,
} from "@/lib/pm/attribution";

const users = [
  { id: "u1", name: "Alex Rivera" },
  { id: "u2", name: "Jordan Lee" },
];

describe("attribution helpers", () => {
  it("normalizes unknown sources", () => {
    expect(normalizeCreationSource("manual")).toBe("manual");
    expect(normalizeCreationSource("cursor")).toBe("unknown");
    expect(normalizeCreationSource(null)).toBe("unknown");
  });

  it("labels sources clearly", () => {
    expect(creationSourceLabel("csv_import")).toBe("CSV import");
    expect(creationSourceBadge("unknown")).toBe("Unknown");
    expect(creationSourceBadge("automation")).toBe("Automation");
  });

  it("builds insert payloads", () => {
    expect(attributionPayload("qa_batch", { created_by: "u1", context: { reported_by_name: "Pat" } })).toEqual({
      creation_source: "qa_batch",
      creation_context: { reported_by_name: "Pat" },
      created_by: "u1",
    });
  });

  it("shows creator + source for non-manual mechanisms", () => {
    const d = formatAttribution(
      { created_by: "u1", creation_source: "csv_import" },
      users,
    );
    expect(d.primary).toBe("Created by Alex Rivera · CSV import");
    expect(d.compact).toBe("Alex Rivera · CSV import");
    expect(d.secondary).toBeNull();
  });

  it("omits source suffix for manual creates", () => {
    const d = formatAttribution(
      { created_by: "u1", creation_source: "manual" },
      users,
    );
    expect(d.primary).toBe("Created by Alex Rivera");
    expect(d.compact).toBe("Alex Rivera");
  });

  it("collapses requester when same as creator", () => {
    const d = formatAttribution(
      { created_by: "u1", requested_by: "u1", creation_source: "intake" },
      users,
    );
    expect(d.showRequesterSeparately).toBe(false);
    expect(d.secondary).toBeNull();
    expect(d.primary).toContain("Alex Rivera");
  });

  it("shows requester separately when different", () => {
    const d = formatAttribution(
      { created_by: "u1", requested_by: "u2", creation_source: "intake" },
      users,
    );
    expect(d.showRequesterSeparately).toBe(true);
    expect(d.secondary).toBe("Requested by Jordan Lee");
  });

  it("handles legacy unknown records honestly", () => {
    const d = formatAttribution({ created_by: null, creation_source: "unknown" }, users);
    expect(d.primary).toBe("Creator/source unknown");
    expect(d.compact).toBe("Unknown");
  });

  it("uses public form submitter name when no user id", () => {
    const d = formatAttribution(
      {
        created_by: null,
        creation_source: "public_form",
        creation_context: { submitter_name: "Sam External" },
      },
      users,
    );
    expect(d.primary).toBe("Submitted by Sam External · Public form");
  });

  it("uses QA reporter name from context", () => {
    const d = formatAttribution(
      {
        created_by: "u1",
        creation_source: "qa_batch",
        creation_context: { reported_by_name: "QA Bot" },
      },
      users,
    );
    expect(d.primary).toBe("Created by Alex Rivera · QA batch");
  });

  it("labels system paths without a creator", () => {
    expect(formatAttribution({ creation_source: "template" }, users).primary).toBe(
      "Created via template",
    );
    expect(formatAttribution({ creation_source: "automation" }, users).primary).toBe(
      "Created via automation",
    );
  });
});

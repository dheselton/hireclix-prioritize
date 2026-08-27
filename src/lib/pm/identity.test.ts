import { describe, expect, it } from "vitest";
import {
  isUniqueViolation,
  normalizeClientName,
  normalizeEmail,
  clientNameKey,
  namesMatchClient,
  uniqueViolationMessage,
} from "@/lib/pm/identity";

describe("identity uniqueness helpers", () => {
  it("normalizes client names and emails", () => {
    expect(normalizeClientName("  Hire  Clix ")).toBe("Hire Clix");
    expect(normalizeEmail("  Dan@HireClix.COM ")).toBe("dan@hireclix.com");
  });

  it("matches clients case-insensitively like the DB unique index", () => {
    expect(clientNameKey("  Hire  Clix ")).toBe("hire clix");
    expect(namesMatchClient("ACME Corp", "acme   corp")).toBe(true);
    expect(namesMatchClient("ACME", "ACME Inc")).toBe(false);
  });

  it("detects Postgres unique violations", () => {
    expect(isUniqueViolation({ code: "23505", message: "duplicate key" })).toBe(true);
    expect(isUniqueViolation({ message: "duplicate key value violates unique constraint" })).toBe(true);
    expect(isUniqueViolation({ message: "permission denied" })).toBe(false);
  });

  it("maps unique violations to clear product copy", () => {
    expect(
      uniqueViolationMessage(
        { code: "23505", message: 'duplicate key value violates unique constraint "clients_name_normalized_unique"' },
        "Failed",
      ),
    ).toBe("A client with this name already exists");

    expect(
      uniqueViolationMessage(
        { code: "23505", message: 'duplicate key value violates unique constraint "pm_users_email_normalized_unique"' },
        "Failed",
      ),
    ).toBe("A user with this email already exists");

    expect(
      uniqueViolationMessage(
        { code: "23505", message: 'duplicate key value violates unique constraint "pm_portal_access_client_email_unique"' },
        "Failed",
      ),
    ).toBe("This email already has portal access for this client");

    expect(
      uniqueViolationMessage({ message: "permission denied" }, "Failed"),
    ).toBe("permission denied");
  });
});

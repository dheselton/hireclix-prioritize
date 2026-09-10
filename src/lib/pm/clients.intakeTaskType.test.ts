import { describe, expect, it } from "vitest";
import { intakeTaskTypeForRequest } from "./clients";

describe("intakeTaskTypeForRequest", () => {
  it("stamps dev for house-account Dev Quick Requests", () => {
    expect(intakeTaskTypeForRequest("dev_api")).toBe("dev");
    expect(intakeTaskTypeForRequest("dev_reporting")).toBe("dev");
    expect(intakeTaskTypeForRequest("dev_bug")).toBe("dev");
    expect(intakeTaskTypeForRequest("dev_spike")).toBe("dev");
  });

  it("keeps design for career-site and creative intake", () => {
    expect(intakeTaskTypeForRequest("careersite_update")).toBe("design");
    expect(intakeTaskTypeForRequest("web_edit")).toBe("design");
    expect(intakeTaskTypeForRequest("general")).toBe("design");
    expect(intakeTaskTypeForRequest(null)).toBe("design");
  });
});

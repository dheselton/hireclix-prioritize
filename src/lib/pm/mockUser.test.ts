import { describe, expect, it } from "vitest";
import { isAuthEnabled, getCurrentUserId, setCurrentPmUserCache, clearCurrentPmUserCache } from "@/lib/pm/mockUser";
import type { PmUser } from "@/types/pm";

describe("auth identity helpers", () => {
  it("treats auth as always enabled", () => {
    expect(isAuthEnabled()).toBe(true);
  });

  it("exposes the cached linked PM user id", () => {
    clearCurrentPmUserCache();
    expect(getCurrentUserId()).toBeNull();

    const user: PmUser = {
      id: "user-1",
      name: "Test User",
      role: "pm",
      email: "test@hireclix.com",
      avatar_url: null,
      capacity_hours_per_week: 40,
    };
    setCurrentPmUserCache(user);
    expect(getCurrentUserId()).toBe("user-1");
    clearCurrentPmUserCache();
    expect(getCurrentUserId()).toBeNull();
  });
});

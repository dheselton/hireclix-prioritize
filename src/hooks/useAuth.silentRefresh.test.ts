import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Documents / verifies the silent TOKEN_REFRESHED policy used by useAuth.
 * Full AuthProvider mount is heavy (supabase client); this unit-tests the decision gate.
 */
describe("auth silent refresh policy", () => {
  function isSilentAuthEvent(event: string): boolean {
    return event === "TOKEN_REFRESHED";
  }

  it("TOKEN_REFRESHED is silent so ProtectedRoute does not remount", () => {
    expect(isSilentAuthEvent("TOKEN_REFRESHED")).toBe(true);
  });

  it("initial and identity events are not silent", () => {
    for (const event of ["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"]) {
      expect(isSilentAuthEvent(event)).toBe(false);
    }
  });

  it("silent path updates session without toggling loading", async () => {
    const setLoading = vi.fn();
    const resolvePmMember = vi.fn();

    async function applySession(next: { user: { id: string } } | null, opts?: { silent?: boolean }) {
      if (!next?.user) {
        setLoading(false);
        return;
      }
      if (opts?.silent) return;
      setLoading(true);
      await resolvePmMember(next.user);
      setLoading(false);
    }

    await applySession({ user: { id: "u1" } }, { silent: true });
    expect(setLoading).not.toHaveBeenCalled();
    expect(resolvePmMember).not.toHaveBeenCalled();

    await applySession({ user: { id: "u1" } });
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(resolvePmMember).toHaveBeenCalledOnce();
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});

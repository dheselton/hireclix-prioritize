import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { blockedRoutePrefixes, fallbackPath } from "@/lib/pm/permissions";

/**
 * Redirects users away from routes their role can't access.
 *
 * Kept under the old filename + export alias to avoid churn in App.tsx; rules
 * now come from `src/lib/pm/permissions.ts`.
 */
export function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentUser();
  const { pathname } = useLocation();
  const blocked = blockedRoutePrefixes(role);
  if (blocked.some(p => pathname.startsWith(p))) {
    return <Navigate to={fallbackPath(role)} replace />;
  }
  return <>{children}</>;
}

/** @deprecated Use `RoleRouteGuard` — kept as an alias for existing imports. */
export const SubmitterRouteGuard = RoleRouteGuard;

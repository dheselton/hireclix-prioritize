import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/lib/pm/mockUser";

const BLOCKED_PREFIXES = [
  "/pm/board",
  "/pm/workload",
  "/pm/timeline",
  "/pm/templates",
  "/pm/integrations",
  "/pm/forms/", // form builder (public /f/:slug routes are outside /pm)
  "/snippets",
];

/** Redirects submitters away from pages they shouldn't see. */
export function SubmitterRouteGuard({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentUser();
  const { pathname } = useLocation();
  if (role === "submitter" && BLOCKED_PREFIXES.some(p => pathname.startsWith(p))) {
    return <Navigate to="/pm" replace />;
  }
  return <>{children}</>;
}

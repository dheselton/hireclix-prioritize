import { useEffect, useState, useCallback, useMemo } from "react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import type { TaskType, PmRole } from "@/types/pm";

/**
 * Role-aware task TYPE filter. Replaces the old Track toggle.
 * Designers default to design-related tasks; developers to dev-related; PMs see everything.
 * Stored per-page+role in sessionStorage so a user can override per view but the override
 * doesn't bleed across roles.
 */
export const TYPE_LABEL: Record<TaskType, string> = {
  design: "Design",
  content: "Content",
  dev: "Dev",
  qa: "QA",
  review: "Review",
  approval: "Approval",
  strategy: "Strategy",
  research: "Research",
  analytics: "Analytics",
  reporting: "Reporting",
};

const ALL_TYPES: TaskType[] = ["design", "content", "dev", "qa", "review", "approval", "strategy", "research", "analytics", "reporting"];

function defaultsForSingleRole(role: PmRole | null | undefined): Set<TaskType> {
  if (role === "designer") return new Set<TaskType>(["design", "content"]);
  if (role === "developer") return new Set<TaskType>(["dev", "qa"]);
  if (role === "strategist") return new Set<TaskType>(["strategy", "research"]);
  if (role === "analyst") return new Set<TaskType>(["analytics", "reporting"]);
  if (role === "qa") return new Set<TaskType>(["qa", "review"]);
  if (role === "csm") return new Set<TaskType>(["approval", "review"]);
  if (role === "support") return new Set<TaskType>(["dev", "qa"]);
  return new Set<TaskType>(); // pm + submitter = all
}

export function defaultTypesForRole(role: PmRole | null | undefined): Set<TaskType> {
  return defaultsForSingleRole(role);
}

export function defaultTypesForRoles(roles: PmRole[] | null | undefined): Set<TaskType> {
  if (!roles || !roles.length) return new Set<TaskType>();
  // PM in the set = show all (empty set means "all").
  if (roles.includes("pm") || roles.includes("submitter")) return new Set<TaskType>();
  const out = new Set<TaskType>();
  for (const r of roles) for (const t of defaultsForSingleRole(r)) out.add(t);
  return out;
}

const keyFor = (page: string, role: PmRole | null | undefined) =>
  `pm.typeFilter.${page}.${role ?? "anon"}`;

export function useTypeFilter(page: string) {
  const { user, roles } = useCurrentUser();
  const role = user?.role ?? null;
  const defaultSet = useMemo(() => defaultTypesForRoles(roles), [roles]);

  const read = useCallback((): Set<TaskType> => {
    if (typeof window === "undefined") return new Set(defaultSet);
    try {
      const raw = sessionStorage.getItem(keyFor(page, role));
      if (raw == null) return new Set(defaultSet);
      const parsed = JSON.parse(raw) as TaskType[];
      return new Set(parsed);
    } catch {
      return new Set(defaultSet);
    }
  }, [page, role, defaultSet]);

  const [types, setTypesState] = useState<Set<TaskType>>(read);

  // Re-seed when the role changes (user switched in TopBar).
  useEffect(() => { setTypesState(read()); }, [read]);

  const persist = useCallback((next: Set<TaskType>) => {
    try { sessionStorage.setItem(keyFor(page, role), JSON.stringify([...next])); } catch {}
    setTypesState(next);
  }, [page, role]);

  const setTypes = useCallback((next: Set<TaskType>) => persist(new Set(next)), [persist]);
  const showAll = useCallback(() => persist(new Set<TaskType>()), [persist]);
  const resetToDefault = useCallback(() => persist(new Set(defaultSet)), [persist, defaultSet]);

  // "isDefault" means the current set matches the role default (including the empty=all case).
  const isDefault = useMemo(() => {
    if (types.size !== defaultSet.size) return false;
    for (const t of defaultSet) if (!types.has(t)) return false;
    return true;
  }, [types, defaultSet]);

  return { types, setTypes, isDefault, showAll, resetToDefault, role, allTypes: ALL_TYPES };
}

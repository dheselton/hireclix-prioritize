import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MockUser, PmRole } from '@/types/pm';

const STORAGE_KEY = 'pm.currentUserId';

let cachedUsers: MockUser[] = [];
const userSubscribers = new Set<() => void>();

async function loadUsers() {
  const { data } = await supabase.from('mock_users').select('*').order('role');
  cachedUsers = (data || []) as MockUser[];
  userSubscribers.forEach(fn => fn());
  // If no current id yet, default to a PM
  if (!currentId && cachedUsers.length) {
    const pm = cachedUsers.find(u => u.role === 'pm') ?? cachedUsers[0];
    writeCurrentId(pm.id);
  }
}

export function useMockUsers() {
  const [users, setUsers] = useState<MockUser[]>(cachedUsers);
  useEffect(() => {
    const fn = () => setUsers([...cachedUsers]);
    userSubscribers.add(fn);
    if (!cachedUsers.length) loadUsers();
    else fn();
    return () => { userSubscribers.delete(fn); };
  }, []);
  return users;
}

// --- Current user pub/sub store ---
let currentId: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const currentSubscribers = new Set<() => void>();

function writeCurrentId(id: string | null) {
  currentId = id;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  currentSubscribers.forEach(fn => fn());
}

export function useCurrentUser() {
  const users = useMockUsers();
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force(n => n + 1);
    currentSubscribers.add(fn);
    return () => { currentSubscribers.delete(fn); };
  }, []);

  const setCurrent = useCallback((nid: string) => {
    writeCurrentId(nid);
  }, []);

  const user = users.find(u => u.id === currentId) ?? null;
  const roles: PmRole[] = (user?.roles && user.roles.length
    ? user.roles
    : [user?.role, user?.secondary_role].filter(Boolean) as PmRole[]) as PmRole[];
  return { user, users, setCurrent, role: (user?.role ?? 'pm') as PmRole, roles: roles.length ? roles : ['pm' as PmRole] };
}

/** Non-hook accessor for the active mock user id (reads localStorage). */
export function getCurrentUserId(): string | null {
  if (currentId) return currentId;
  if (typeof window !== 'undefined') {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  return null;
}

/** Role of the active mock user, if known in cache. */
export function getCurrentUserRole(): PmRole | null {
  const id = getCurrentUserId();
  if (!id) return null;
  const u = cachedUsers.find(x => x.id === id);
  return (u?.role as PmRole) ?? null;
}

/**
 * Auth-ready accessor. When `VITE_PM_AUTH_ENABLED` is true and a Supabase
 * session exists, this returns the authenticated user id; otherwise it falls
 * back to the localStorage-backed mock user. All call sites that need the
 * "current actor" id should go through this helper so flipping auth on later
 * is a single-flag change.
 */
export async function getAuthUserId(): Promise<string | null> {
  const enabled = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PM_AUTH_ENABLED === "true";
  if (enabled) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) return data.user.id;
    } catch { /* fall through to mock */ }
  }
  return getCurrentUserId();
}

/** True when real auth is enabled. The TopBar role switcher hides when true. */
export function isAuthEnabled(): boolean {
  return typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PM_AUTH_ENABLED === "true";
}

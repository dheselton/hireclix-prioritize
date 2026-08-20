import { queryClient } from '@/lib/queryClient';
import type { PmUser, PmRole } from '@/types/pm';

/** Module cache kept in sync by AuthProvider for non-React callers (api.ts, etc.). */
let currentUser: PmUser | null = null;
const currentSubscribers = new Set<() => void>();

export function setCurrentPmUserCache(user: PmUser | null) {
  const changed = currentUser?.id !== user?.id;
  currentUser = user;
  try {
    localStorage.removeItem('pm.currentUserId');
  } catch { /* ignore */ }
  currentSubscribers.forEach(fn => fn());
  if (changed) {
    try { queryClient.invalidateQueries(); } catch { /* ignore */ }
  }
}

export function clearCurrentPmUserCache() {
  setCurrentPmUserCache(null);
}

export function getCurrentUserId(): string | null {
  return currentUser?.id ?? null;
}

export function getCurrentUserRole(): PmRole | null {
  return (currentUser?.role as PmRole) ?? null;
}

export function getCachedPmUser(): PmUser | null {
  return currentUser;
}

export function subscribeCurrentPmUser(fn: () => void): () => void {
  currentSubscribers.add(fn);
  return () => { currentSubscribers.delete(fn); };
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PmUser, PmRole } from '@/types/pm';
import { useAuth } from '@/hooks/useAuth';
import {
  getCurrentUserId as getCachedId,
  getCachedPmUser,
} from '@/lib/pm/pmIdentity';
import { loadPmRoster, getCachedRoster, subscribeRoster } from '@/lib/pm/pmRoster';

/** @deprecated Prefer PmUser — kept for existing imports */
export type MockUser = PmUser;

export { loadPmRoster };

export function useMockUsers() {
  const [users, setUsers] = useState<PmUser[]>(getCachedRoster());
  useEffect(() => {
    const unsub = subscribeRoster(() => setUsers([...getCachedRoster()]));
    if (!getCachedRoster().length) void loadPmRoster();
    else setUsers([...getCachedRoster()]);
    return unsub;
  }, []);
  return users;
}

/** Alias for the authenticated roster directory */
export const usePmUsers = useMockUsers;

/**
 * Signed-in PM member from AuthProvider (source of truth for React).
 */
export function useCurrentUser() {
  const auth = useAuth();
  const users = useMockUsers();

  const setCurrent = useCallback((_nid: string) => {
    // impersonation removed
  }, []);

  const user = auth.pmUser ?? getCachedPmUser();
  const roles: PmRole[] = auth.roles.length
    ? auth.roles
    : ((user?.roles && user.roles.length
      ? user.roles
      : [user?.role, user?.secondary_role].filter(Boolean)) as PmRole[]);

  return {
    user,
    users,
    setCurrent,
    role: (user?.role ?? roles[0] ?? 'pm') as PmRole,
    roles: roles.length ? roles : (['pm'] as PmRole[]),
    loading: auth.loading || auth.access === 'loading',
    access: auth.access,
  };
}

export {
  setCurrentPmUserCache,
  clearCurrentPmUserCache,
  getCurrentUserId,
  getCurrentUserRole,
} from '@/lib/pm/pmIdentity';

/** Auth-ready accessor — always the linked PM user when signed in. */
export async function getAuthUserId(): Promise<string | null> {
  const cached = getCachedId();
  if (cached) return cached;
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return null;
    const { data } = await supabase
      .from('pm_users')
      .select('id')
      .eq('auth_user_id', auth.user.id)
      .eq('is_active', true)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/** Real auth is always on. */
export function isAuthEnabled(): boolean {
  return true;
}

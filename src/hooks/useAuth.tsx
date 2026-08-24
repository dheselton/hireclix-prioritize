import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { PmUser, PmRole } from '@/types/pm';
import {
  setCurrentPmUserCache,
  clearCurrentPmUserCache,
} from '@/lib/pm/pmIdentity';
import { loadPmRoster } from '@/lib/pm/pmRoster';

type AccessState = 'loading' | 'anonymous' | 'approved' | 'pending' | 'denied';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  access: AccessState;
  pmUser: PmUser | null;
  roles: PmRole[];
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshPmUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function rolesFromMember(member: PmUser | null): PmRole[] {
  if (!member) return [];
  const list = (member.roles && member.roles.length
    ? member.roles
    : [member.role, member.secondary_role].filter(Boolean)) as PmRole[];
  return list.length ? list : [member.role];
}

type ResolveResult = { member: PmUser | null; pending: boolean };

async function resolvePmMember(authUser: User): Promise<ResolveResult> {
  const { error: claimError } = await supabase.rpc('claim_pm_user');
  if (claimError) {
    console.warn('claim_pm_user failed', claimError.message);
  }

  const { data, error } = await supabase
    .from('pm_users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error) {
    console.warn('pm_users lookup failed', error.message);
    return { member: null, pending: false };
  }

  const row = (data as PmUser | null) ?? null;
  if (row?.is_active) return { member: row, pending: false };
  if (row) return { member: null, pending: true };
  return { member: null, pending: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pmUser, setPmUser] = useState<PmUser | null>(null);
  const [access, setAccess] = useState<AccessState>('loading');
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);

    if (!next?.user) {
      setPmUser(null);
      clearCurrentPmUserCache();
      setAccess('anonymous');
      setLoading(false);
      return;
    }

    setLoading(true);
    const { member, pending } = await resolvePmMember(next.user);
    if (member) {
      setPmUser(member);
      setCurrentPmUserCache(member);
      setAccess('approved');
      void loadPmRoster();
    } else {
      setPmUser(null);
      clearCurrentPmUserCache();
      setAccess(pending ? 'pending' : 'denied');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Avoid deadlocks: resolve async after the callback returns
      setTimeout(() => { void applySession(session); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signInWithGoogle = async () => {
    // Land on /auth (outside ProtectedRoute). Redirecting to `/` used to
    // immediately Navigate → /pm and strip ?code= before the PKCE exchange.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { hd: 'hireclix.com' },
      },
    });
    return { error };
  };

  const signOut = async () => {
    clearCurrentPmUserCache();
    setPmUser(null);
    setAccess('anonymous');
    await supabase.auth.signOut();
  };

  const refreshPmUser = useCallback(async () => {
    if (!user) return;
    const { member, pending } = await resolvePmMember(user);
    setPmUser(member);
    if (member) {
      setCurrentPmUserCache(member);
      setAccess('approved');
    } else {
      clearCurrentPmUserCache();
      setAccess(pending ? 'pending' : 'denied');
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        access,
        pmUser,
        roles: rolesFromMember(pmUser),
        signInWithGoogle,
        signOut,
        refreshPmUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

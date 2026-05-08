import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MockUser, PmRole } from '@/types/pm';

const STORAGE_KEY = 'pm.currentUserId';

let cachedUsers: MockUser[] = [];
const subscribers = new Set<() => void>();

async function loadUsers() {
  const { data } = await supabase.from('mock_users').select('*').order('role');
  cachedUsers = (data || []) as MockUser[];
  subscribers.forEach(fn => fn());
}

export function useMockUsers() {
  const [users, setUsers] = useState<MockUser[]>(cachedUsers);
  useEffect(() => {
    const fn = () => setUsers([...cachedUsers]);
    subscribers.add(fn);
    if (!cachedUsers.length) loadUsers();
    else fn();
    return () => { subscribers.delete(fn); };
  }, []);
  return users;
}

export function useCurrentUser() {
  const users = useMockUsers();
  const [id, setId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (!id && users.length) {
      const pm = users.find(u => u.role === 'pm') ?? users[0];
      setId(pm.id);
      localStorage.setItem(STORAGE_KEY, pm.id);
    }
  }, [users, id]);

  const setCurrent = useCallback((nid: string) => {
    setId(nid);
    localStorage.setItem(STORAGE_KEY, nid);
  }, []);

  const user = users.find(u => u.id === id) ?? null;
  return { user, users, setCurrent, role: (user?.role ?? 'pm') as PmRole };
}

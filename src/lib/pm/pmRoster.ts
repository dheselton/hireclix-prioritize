import { supabase } from '@/integrations/supabase/client';
import type { PmUser } from '@/types/pm';

let cachedUsers: PmUser[] = [];
const userSubscribers = new Set<() => void>();

function notifyRoster() {
  userSubscribers.forEach(fn => fn());
}

export function getCachedRoster(): PmUser[] {
  return cachedUsers;
}

export function subscribeRoster(fn: () => void): () => void {
  userSubscribers.add(fn);
  return () => { userSubscribers.delete(fn); };
}

export async function loadPmRoster(): Promise<PmUser[]> {
  const { data } = await supabase.from('pm_users').select('*').eq('is_active', true).order('role');
  cachedUsers = (data || []) as PmUser[];
  notifyRoster();
  return cachedUsers;
}

import { supabase } from '@/integrations/supabase/client';
import type { PmUser } from '@/types/pm';

let cachedUsers: PmUser[] = [];
const userSubscribers = new Set<() => void>();
let realtimeStarted = false;
let focusListenerAttached = false;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

function notifyRoster() {
  userSubscribers.forEach(fn => fn());
}

export function getCachedRoster(): PmUser[] {
  return cachedUsers;
}

export function subscribeRoster(fn: () => void): () => void {
  userSubscribers.add(fn);
  ensureRosterLiveUpdates();
  return () => { userSubscribers.delete(fn); };
}

function scheduleRosterReload() {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    refetchTimer = null;
    void loadPmRoster();
  }, 250);
}

/** Keep the roster fresh when teammates change avatars/names. */
function ensureRosterLiveUpdates() {
  if (typeof window === 'undefined') return;

  if (!focusListenerAttached) {
    focusListenerAttached = true;
    window.addEventListener('focus', () => {
      void loadPmRoster();
    });
  }

  if (realtimeStarted) return;
  realtimeStarted = true;

  supabase
    .channel('pm-users-roster')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pm_users' },
      () => scheduleRosterReload(),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Allow a later subscribeRoster call to retry.
        realtimeStarted = false;
      }
    });
}

export async function loadPmRoster(): Promise<PmUser[]> {
  const { data } = await supabase.from('pm_users').select('*').eq('is_active', true).order('role');
  cachedUsers = (data || []) as PmUser[];
  notifyRoster();
  return cachedUsers;
}

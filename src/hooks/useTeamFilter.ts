import { useCallback, useEffect, useState, useMemo } from "react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { ROLE_TO_TEAM, TEAM_LABEL, TEAM_PEERS, TEAM_PEER_LABEL, USER_TEAM_OVERRIDES, teamsFromTask, type Team } from "@/lib/pm/teams";
import type { PmTask } from "@/types/pm";

const key = (scope: string, userId: string | null | undefined) =>
  `pm.showAllTeams.${scope}.${userId ?? "anon"}`;

/**
 * "My team only" default filter. Sticky per scope (e.g. projectId) + user.
 * - PM role and submitter bypass (always show all).
 * - User without a mapped team falls back to showAll.
 */
export function useTeamFilter(scope: string) {
  const { user } = useCurrentUser();
  const role = user?.role ?? null;
  const meId = user?.id ?? null;
  const myTeam: Team | null = role ? ROLE_TO_TEAM[role] : null;
  const bypass = role === "pm" || role === "submitter" || !myTeam;

  const read = useCallback((): boolean => {
    if (bypass) return true;
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(key(scope, meId)) === "1"; } catch { return false; }
  }, [scope, meId, bypass]);

  const [showAll, setShowAllState] = useState<boolean>(read);
  useEffect(() => { setShowAllState(read()); }, [read]);

  const setShowAll = useCallback((v: boolean) => {
    if (bypass) return;
    try { localStorage.setItem(key(scope, meId), v ? "1" : "0"); } catch {}
    setShowAllState(v);
  }, [scope, meId, bypass]);

  const filterTask = useCallback((t: PmTask): boolean => {
    if (showAll || bypass) return true;
    if (meId && t.assignee_id === meId) return true;
    const teams = teamsFromTask(t);
    if (!teams.length) return true; // untagged tasks visible to all (avoids stranding)
    if (!myTeam) return true;
    const peers = TEAM_PEERS[myTeam] ?? [myTeam];
    return teams.some((tm) => peers.includes(tm));
  }, [showAll, bypass, meId, myTeam]);

  const label = useMemo(() => {
    if (bypass) return "All tasks";
    if (showAll) return "All tasks";
    if (!myTeam) return "All tasks";
    const peerLabel = TEAM_PEER_LABEL[myTeam];
    return `My team (${peerLabel ?? TEAM_LABEL[myTeam]})`;
  }, [bypass, showAll, myTeam]);

  return { showAll, setShowAll, filterTask, myTeam, bypass, label };
}

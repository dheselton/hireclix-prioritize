import type { MockUser, PmTask, Track } from "@/types/pm";

/** A user's primary track: PMs are 'pm', everyone else 'production'. */
export function userTrack(user: Pick<MockUser, "role"> | null | undefined): Track {
  if (!user) return "production";
  return user.role === "pm" ? "pm" : "production";
}

/** True if user can perform production work (designer or developer, primary or secondary). */
export function isProductionUser(user: Pick<MockUser, "role" | "secondary_role"> | null | undefined): boolean {
  if (!user) return false;
  const roles = [user.role, user.secondary_role].filter(Boolean) as string[];
  return roles.some(r => r === "designer" || r === "developer");
}

export function applyTaskTrack(
  tasks: PmTask[],
  mode: "mine" | "other" | "all",
  myTrack: Track,
): PmTask[] {
  if (mode === "all") return tasks;
  const want: Track = mode === "mine" ? myTrack : (myTrack === "pm" ? "production" : "pm");
  return tasks.filter(t => (t.track ?? "production") === want);
}

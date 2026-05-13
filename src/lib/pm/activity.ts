// Lightweight per-user "last touched task" tracker. Stored in localStorage,
// keyed by mock_user id. One entry per (user, project) pair — most recent task.
// We persist client-side (rather than a new table) because the mock-user model
// doesn't have real auth and we only need it for "Pick up where you left off".

const KEY = (userId: string) => `pm.activity.${userId}`;

export type ActivityMap = Record<string, { taskId: string; at: number }>; // projectId -> entry

function read(userId: string): ActivityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as ActivityMap) : {};
  } catch {
    return {};
  }
}

function write(userId: string, map: ActivityMap) {
  try {
    window.localStorage.setItem(KEY(userId), JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("pm:activity-changed"));
  } catch {}
}

export function recordTaskActivity(userId: string | null | undefined, projectId: string | null | undefined, taskId: string) {
  if (!userId || !projectId) return;
  const map = read(userId);
  map[projectId] = { taskId, at: Date.now() };
  write(userId, map);
}

export function getResumeForProject(userId: string | null | undefined, projectId: string): { taskId: string; at: number } | null {
  if (!userId) return null;
  return read(userId)[projectId] ?? null;
}

export function getAllResume(userId: string | null | undefined): ActivityMap {
  if (!userId) return {};
  return read(userId);
}

export function fmtAgo(at: number): string {
  const ms = Date.now() - at;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/** Subscribe to activity changes (cross-tab and same-tab). */
export function onActivityChanged(cb: () => void): () => void {
  const handler = () => cb();
  const storage = (e: StorageEvent) => { if (e.key && e.key.startsWith("pm.activity.")) cb(); };
  window.addEventListener("pm:activity-changed", handler);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("pm:activity-changed", handler);
    window.removeEventListener("storage", storage);
  };
}

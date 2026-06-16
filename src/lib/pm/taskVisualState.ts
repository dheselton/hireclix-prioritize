/**
 * Single source of truth for "what does this task card look like right now":
 *  - team colors (with multi-team striped support)
 *  - waiting/dimmed state (dependency-blocked OR far-future start)
 *
 * Used by BoardTaskCard, ProjectTaskCard, RequestTaskCard, TaskListView.
 */

import type { PmTask, PmDependency } from "@/types/pm";
import { teamsFromTask, TEAM_COLOR, type Team } from "@/lib/pm/teams";
import { firstUnmetPredecessor } from "@/lib/pm/reveal";

const WAITING_START_DAYS = 7;
const DONE_STATES = new Set(["complete", "approved"]);

export interface TaskVisualState {
  teams: Team[];
  /** CSS background for the left color bar — solid color or repeating stripes. */
  teamBarBackground: string | null;
  waiting: boolean;
  waitingReason: string | null;
}

/** Build a CSS background value for the team color bar. */
export function teamBarBackground(teams: Team[]): string | null {
  if (!teams.length) return null;
  if (teams.length === 1) return TEAM_COLOR[teams[0]];
  // Diagonal stripes alternating between teams (cycle through all).
  const stripe = 8; // px per stripe
  const stops: string[] = [];
  teams.forEach((t, i) => {
    const a = i * stripe;
    const b = (i + 1) * stripe;
    stops.push(`${TEAM_COLOR[t]} ${a}px ${b}px`);
  });
  return `repeating-linear-gradient(135deg, ${stops.join(", ")})`;
}

/**
 * Decide if a task should render dimmed/waiting.
 *  - Dependency-blocked (any unmet predecessor), OR
 *  - start_date > today + WAITING_START_DAYS AND status is unclaimed (not actively worked).
 *
 * Caller can pass `meId` to opt the assignee out of dimming so people working
 * the task always see it active.
 */
export function computeTaskVisualState(
  task: PmTask,
  tasks: PmTask[],
  deps: PmDependency[],
  opts: { meId?: string | null; bypassWaiting?: boolean } = {},
): TaskVisualState {
  const teams = teamsFromTask(task);
  const bar = teamBarBackground(teams);

  const isMine = !!opts.meId && task.assignee_id === opts.meId;
  const isDone = DONE_STATES.has(task.status);

  if (opts.bypassWaiting || isMine || isDone) {
    return { teams, teamBarBackground: bar, waiting: false, waitingReason: null };
  }

  const unmet = firstUnmetPredecessor(task.id, tasks, deps);
  if (unmet) {
    return {
      teams,
      teamBarBackground: bar,
      waiting: true,
      waitingReason: `Waiting on: ${unmet.predecessor.title}`,
    };
  }

  if (task.start_date && task.status === "unclaimed") {
    const start = new Date(task.start_date);
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() + WAITING_START_DAYS);
    if (start > cutoff) {
      return {
        teams,
        teamBarBackground: bar,
        waiting: true,
        waitingReason: `Starts ${start.toLocaleDateString("en-US")}`,
      };
    }
  }

  return { teams, teamBarBackground: bar, waiting: false, waitingReason: null };
}

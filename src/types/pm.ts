export type PmRole = 'pm' | 'designer' | 'developer' | 'submitter' | 'strategist' | 'analyst' | 'qa' | 'csm' | 'support' | 'ba' | 'tech_lead';
export type TaskType = 'design' | 'dev' | 'review' | 'approval' | 'content' | 'qa' | 'strategy' | 'research' | 'analytics' | 'reporting';
// Canonical team vocabulary lives in src/lib/pm/teams.ts — re-exported here
// so existing `import type { Team } from "@/types/pm"` call sites keep working.
export type { Team } from "@/lib/pm/teams";
export type TaskStatus = 'unclaimed' | 'claimed' | 'in_progress' | 'blocked' | 'in_review' | 'approved' | 'complete';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectType = 'quick_request' | 'career_site' | 'rfp' | 'evp' | 'dev' | 'candidate_experience';
export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'in_review' | 'complete' | 'archived';
export type DepType = 'finish_start' | 'start_start' | 'finish_finish';

export interface MockUser {
  id: string;
  name: string;
  role: PmRole;
  secondary_role?: PmRole | null;
  roles?: PmRole[] | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color?: string | null;
  capacity_hours_per_week: number;
}

export type Track = 'pm' | 'production' | 'strategy' | 'analytics';

export type WorkType = 'request' | 'project';
export const WORK_TYPES: WorkType[] = ['request', 'project'];

export interface PmProject {
  id: string;
  title: string;
  client_id: string | null;
  type: ProjectType;
  work_type: WorkType;
  status: ProjectStatus;
  go_live_date: string | null;
  start_date: string | null;
  kickoff_date: string | null;
  description: string | null;
  tags: string[];
  template_id: string | null;
  created_by: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PmPhase {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
}

export interface PmTask {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  assignee_id: string | null;
  created_by: string | null;
  start_date: string | null;
  due_date: string | null;
  duration_days: number;
  min_duration_days: number | null;
  locked: boolean;
  locked_to_kickoff: boolean;
  locked_to_go_live: boolean;
  priority: TaskPriority;
  tags: string[];
  sort_order: number;
  custom_fields: Record<string, any>;
  design_round: number | null;
  design_approval: string | null;
  dev_blocker: string | null;
  dev_status_log: Array<{ at: string; note: string; by?: string }>;
  dev_links: Array<{ label: string; url: string }>;
  dev_environment: string | null;
  track?: Track;
  parent_task_id?: string | null;
  page_label?: string | null;
  page_group_key?: string | null;
  teams?: string[];
  created_at: string;
  updated_at: string;
}

export type RevealMode = 'on_complete' | 'on_start' | 'always';

export interface PmDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  type: DepType;
  lag_days: number;
  reveal_mode?: RevealMode;
}

export const TASK_STATUSES: TaskStatus[] = ['unclaimed','claimed','in_progress','blocked','in_review','approved','complete'];
export const TASK_TYPES: TaskType[] = ['design','dev','review','approval','content','qa','strategy','research','analytics','reporting'];
export const PRIORITIES: TaskPriority[] = ['low','medium','high','urgent'];
export const PROJECT_TYPES: ProjectType[] = ['quick_request','career_site','rfp','evp','dev','candidate_experience'];
export const PROJECT_STATUSES: ProjectStatus[] = ['draft','active','on_hold','in_review','complete','archived'];

export const TERMINAL_STATUSES: TaskStatus[] = ['complete', 'approved'];
export const isDone = (status: TaskStatus): boolean => TERMINAL_STATUSES.includes(status);


export const TYPE_COLORS: Record<TaskType, string> = {
  design: 'hsl(280 70% 60%)',
  dev: 'hsl(150 60% 45%)',
  review: 'hsl(30 90% 55%)',
  approval: 'hsl(200 80% 50%)',
  content: 'hsl(340 70% 55%)',
  qa: 'hsl(50 90% 50%)',
  strategy: 'hsl(260 70% 60%)',
  research: 'hsl(220 60% 55%)',
  analytics: 'hsl(190 70% 45%)',
  reporting: 'hsl(170 60% 45%)',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  unclaimed: 'bg-muted text-muted-foreground',
  claimed: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  blocked: 'bg-red-500/10 text-red-700 dark:text-red-300',
  in_review: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  complete: 'bg-green-500/15 text-green-700 dark:text-green-300',
};

export type CustomerType = "Career Site" | "JobFlow SEO";
export type CustomerStatus = "Prospect" | "In Progress" | "Live" | "Paused" | "Retired";

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  ats: string;
  go_live_date: string | null;
  live_sites: number;
  region: string | null;
  segment: string | null;
  owner: string | null;
  site_url: string | null;
  dashboard_url: string | null;
  notes: string;
  updated_at: string;
}

export type DocType = "one-pager" | "implementation" | "how-to" | "integration" | "design" | "other";
export type DocAudience = "internal" | "client";

export interface Doc {
  id: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  owner: string | null;
  type: DocType;
  audience: DocAudience;
  last_updated: string;
  views_30d: number;
}

export type IntegrationCategory = "ATS" | "Analytics" | "SEO" | "SSO" | "CDN" | "Other";
export type IntegrationStatus = "GA" | "Beta" | "Planned" | "Deprecated";
export type IntegrationHealth = "Healthy" | "Degraded" | "Down";
export type IntegrationDirectionality = "Unidirectional" | "Bidirectional" | "Mixed";

export interface Integration {
  id: string;
  name: string;
  vendor: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  version: string | null;
  docs_link: string | null;
  owner: string | null;
  known_limitations: string;
  last_updated: string;
  health: IntegrationHealth;
  directionality: IntegrationDirectionality;
  capabilities: string[];
}

export type ActivityType = "customer" | "doc" | "integration";
export type ActivityAction = "created" | "updated" | "status_changed" | "note_added";

export interface Activity {
  id: string;
  type: ActivityType;
  entity_id: string;
  action: ActivityAction;
  summary: string;
  timestamp: string;
  actor: string;
}

export interface LoomVideo {
  id: string;
  title: string;
  loom_url: string;
  description: string;
  tags: string[];
  thumbnail_url: string | null;
  duration: string | null;
  view_count: number;
  is_pinned: boolean;
  folder: string | null;
  created_at: string;
  last_updated: string;
}

export type JobApiStatus = "SUCCESS" | "FAILED" | "PARTIAL" | "PENDING";

export interface JobApiLog {
  id: number;
  company_name: string;
  push_id: number;
  push_timestamp: string;
  total_jobs_processed: number;
  jobs_created: number;
  jobs_updated: number;
  jobs_deleted: number;
  total_errors: number;
  push_error_details: {
    errors: any[];
    error_summary: {
      total_errors: number;
      error_types: Record<string, number>;
    };
  };
  execution_time_seconds: number;
  push_status: JobApiStatus;
  push_additional_info: any;
  record_type: string;
  created_at: string;
}

export interface JobApiStats {
  total_pushes: number;
  successful_pushes: number;
  failed_pushes: number;
  total_jobs_processed: number;
  total_errors: number;
  avg_execution_time: number;
}

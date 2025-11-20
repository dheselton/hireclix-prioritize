export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface ReleaseVersion {
  id: string;
  name: string;
  year: number;
  quarter: number | null;
  sort_order: number;
  is_backlog: boolean;
  created_at: string;
}

export type FeatureLevel = 'Core' | 'Integrations' | 'Add-On';
export type FeatureType = 'Front End UI' | 'Back End CMS/Data' | 'SEO' | 'Full Feature' | '3rd Party Integration';
export type FeatureStatus = 'Scope/Ideation' | 'Design' | 'In Development' | 'QA' | 'Approved' | 'Released';

export interface Feature {
  id: string;
  title: string;
  summary?: string;
  product_category_id?: string;
  release_version_id?: string;
  feature_level: FeatureLevel;
  feature_type: FeatureType;
  status: FeatureStatus;
  assignees: string[];
  start_date?: string;
  due_date?: string;
  subtask_count: number;
  documentation?: string;
  design_specs?: string;
  technical_notes?: string;
  qa_plan?: string;
  rollout_instructions?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product_category?: ProductCategory;
  release_version?: ReleaseVersion;
}

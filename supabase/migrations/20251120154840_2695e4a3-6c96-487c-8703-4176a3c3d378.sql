-- Create product_categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create release_versions table
CREATE TABLE IF NOT EXISTS public.release_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  year integer NOT NULL,
  quarter integer,
  sort_order integer NOT NULL,
  is_backlog boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create features table
CREATE TABLE IF NOT EXISTS public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  product_category_id uuid REFERENCES public.product_categories(id),
  release_version_id uuid REFERENCES public.release_versions(id),
  feature_level text NOT NULL CHECK (feature_level IN ('Core', 'Integrations', 'Add-On')),
  feature_type text NOT NULL CHECK (feature_type IN ('Front End UI', 'Back End CMS/Data', 'SEO', 'Full Feature', '3rd Party Integration')),
  status text NOT NULL DEFAULT 'Scope/Ideation' CHECK (status IN ('Scope/Ideation', 'Design', 'In Development', 'QA', 'Approved', 'Released')),
  assignees text[] DEFAULT '{}',
  start_date date,
  due_date date,
  subtask_count integer DEFAULT 0,
  documentation text,
  design_specs text,
  technical_notes text,
  qa_plan text,
  rollout_instructions text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all access for now)
CREATE POLICY "Allow all access to product_categories" ON public.product_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to release_versions" ON public.release_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to features" ON public.features FOR ALL USING (true) WITH CHECK (true);

-- Seed product categories
INSERT INTO public.product_categories (name, description) VALUES
  ('Career Site', 'Career site features and functionality'),
  ('CRM', 'CRM system features'),
  ('Internal Products', 'Internal tools and products'),
  ('External Products', 'External-facing products'),
  ('Integrations', 'Third-party integrations'),
  ('Add-Ons', 'Add-on features and modules');

-- Seed release versions
INSERT INTO public.release_versions (name, year, quarter, sort_order, is_backlog) VALUES
  ('Q2 2025', 2025, 2, 1, false),
  ('Q3 2025', 2025, 3, 2, false),
  ('Q4 2025', 2025, 4, 3, false),
  ('Q1 2026', 2026, 1, 4, false),
  ('Q2 2026', 2026, 2, 5, false),
  ('Q3 2026', 2026, 3, 6, false),
  ('Q4 2026', 2026, 4, 7, false),
  ('Q1 2027', 2027, 1, 8, false),
  ('Q2 2027', 2027, 2, 9, false),
  ('Backlog', 9999, null, 999, true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_features_updated_at
  BEFORE UPDATE ON public.features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_features_updated_at();
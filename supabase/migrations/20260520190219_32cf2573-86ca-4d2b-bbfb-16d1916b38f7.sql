
CREATE TABLE public.pm_template_page_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  name text NOT NULL,
  phase_name text,
  sort_order integer NOT NULL DEFAULT 0,
  parallel boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pm_template_page_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"   ON public.pm_template_page_groups FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_template_page_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_template_page_groups FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_template_page_groups FOR DELETE USING (true);

CREATE TABLE public.pm_template_page_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  page_group_id uuid,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pm_template_page_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"   ON public.pm_template_page_presets FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_template_page_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_template_page_presets FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_template_page_presets FOR DELETE USING (true);

ALTER TABLE public.pm_template_tasks ADD COLUMN page_group_id uuid;
ALTER TABLE public.pm_tasks ADD COLUMN page_label text;
ALTER TABLE public.pm_tasks ADD COLUMN page_group_key text;

CREATE INDEX idx_pm_template_tasks_page_group ON public.pm_template_tasks (page_group_id);
CREATE INDEX idx_pm_tasks_page_group_key      ON public.pm_tasks (project_id, page_group_key);
CREATE INDEX idx_pm_template_page_groups_tpl  ON public.pm_template_page_groups (template_id);
CREATE INDEX idx_pm_template_page_presets_tpl ON public.pm_template_page_presets (template_id);


CREATE TABLE public.pm_tag_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace text NOT NULL CHECK (namespace IN ('type','feature')),
  slug text NOT NULL,
  label text NOT NULL,
  color text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_tag_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_tag_catalog TO anon;
GRANT ALL ON public.pm_tag_catalog TO service_role;

ALTER TABLE public.pm_tag_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_tag_catalog read all" ON public.pm_tag_catalog FOR SELECT USING (true);
CREATE POLICY "pm_tag_catalog insert all" ON public.pm_tag_catalog FOR INSERT WITH CHECK (true);
CREATE POLICY "pm_tag_catalog update all" ON public.pm_tag_catalog FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pm_tag_catalog delete all" ON public.pm_tag_catalog FOR DELETE USING (true);

INSERT INTO public.pm_tag_catalog (namespace, slug, label) VALUES
  ('type','careersite','Career Site'),
  ('type','webflow','Webflow'),
  ('type','integration','Integration'),
  ('type','sow','SOW'),
  ('type','support','Support'),
  ('type','internal','Internal'),
  ('feature','job-feed','Job Feed'),
  ('feature','apply-flow','Apply Flow'),
  ('feature','analytics','Analytics'),
  ('feature','seo','SEO'),
  ('feature','accessibility','Accessibility'),
  ('feature','content','Content'),
  ('feature','design','Design'),
  ('feature','copy','Copy')
ON CONFLICT (namespace, slug) DO NOTHING;

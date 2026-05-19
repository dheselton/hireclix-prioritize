
CREATE TABLE public.pm_snippet_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES public.pm_snippet_categories(id) ON DELETE SET NULL,
  language text,
  tags text[] DEFAULT '{}',
  project_ids uuid[] DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pm_snippet_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id uuid NOT NULL REFERENCES public.pm_snippets(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  code text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_snippet_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_snippet_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"   ON public.pm_snippet_categories FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_snippet_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_snippet_categories FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_snippet_categories FOR DELETE USING (true);

CREATE POLICY "public read"   ON public.pm_snippets FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_snippets FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_snippets FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_snippets FOR DELETE USING (true);

CREATE POLICY "public read"   ON public.pm_snippet_variations FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_snippet_variations FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_snippet_variations FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_snippet_variations FOR DELETE USING (true);

CREATE TRIGGER pm_snippets_set_updated_at
BEFORE UPDATE ON public.pm_snippets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pm_snippet_categories (name, color) VALUES
  ('Webflow',          '221 83% 53%'),
  ('Custom JS',        '38 92% 50%'),
  ('CSS Utilities',    '199 89% 48%'),
  ('HTML Components',  '142 71% 45%'),
  ('Animations',       '292 84% 61%'),
  ('Forms',            '24 95% 53%'),
  ('API / Integrations', '173 80% 40%');

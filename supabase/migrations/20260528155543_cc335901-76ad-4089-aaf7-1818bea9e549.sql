CREATE TABLE public.pm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_notes_user ON public.pm_notes(user_id);
CREATE INDEX idx_pm_notes_due_date ON public.pm_notes(due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_notes TO authenticated;
GRANT ALL ON public.pm_notes TO service_role;

ALTER TABLE public.pm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.pm_notes FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_notes FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_notes FOR DELETE USING (true);

CREATE TRIGGER trg_pm_notes_updated_at
BEFORE UPDATE ON public.pm_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
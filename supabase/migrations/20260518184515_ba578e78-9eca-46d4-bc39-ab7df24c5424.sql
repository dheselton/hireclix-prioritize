-- Extend pm_attachments for links + file metadata
ALTER TABLE public.pm_attachments
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

-- Design rounds
CREATE TABLE IF NOT EXISTS public.pm_design_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  submitted_date date,
  feedback_notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pm_design_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.pm_design_rounds FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_design_rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_design_rounds FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_design_rounds FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_pm_design_rounds_task ON public.pm_design_rounds(task_id);

-- Dev status log (append-only table; client enforces)
CREATE TABLE IF NOT EXISTS public.pm_dev_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  note text NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pm_dev_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.pm_dev_status_log FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.pm_dev_status_log FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.pm_dev_status_log FOR UPDATE USING (true);
CREATE POLICY "public delete" ON public.pm_dev_status_log FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_pm_dev_status_log_task ON public.pm_dev_status_log(task_id);

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "task-attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-attachments');
CREATE POLICY "task-attachments public insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-attachments');
CREATE POLICY "task-attachments public update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'task-attachments');
CREATE POLICY "task-attachments public delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'task-attachments');
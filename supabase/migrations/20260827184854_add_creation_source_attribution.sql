-- Attribution: track how tasks/projects were created (mechanism), separate from created_by (actor).

DO $$ BEGIN
  CREATE TYPE public.pm_creation_source AS ENUM (
    'manual',
    'intake',
    'public_form',
    'csv_import',
    'qa_batch',
    'template',
    'page_generator',
    'automation',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS creation_source public.pm_creation_source NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS creation_context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS creation_source public.pm_creation_source NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS creation_context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pm_tasks.creation_source IS 'Mechanism that created the task (manual UI, import, template, etc.)';
COMMENT ON COLUMN public.pm_projects.creation_source IS 'Mechanism that created the project';
COMMENT ON COLUMN public.pm_tasks.creation_context IS 'Optional metadata for the creation path (form submission, template id, reporter, etc.)';
COMMENT ON COLUMN public.pm_projects.creation_context IS 'Optional metadata for the creation path';

-- Safe backfills only where evidence exists. Leave everything else as 'unknown'.

UPDATE public.pm_projects
SET creation_source = 'template'::public.pm_creation_source,
    creation_context = COALESCE(creation_context, '{}'::jsonb) || jsonb_build_object('template_id', template_id)
WHERE template_id IS NOT NULL
  AND creation_source = 'unknown'::public.pm_creation_source;

UPDATE public.pm_projects p
SET creation_source = (
      CASE
        WHEN f.submitter_email IS NOT NULL OR f.submitter_name IS NOT NULL THEN 'public_form'
        ELSE 'intake'
      END
    )::public.pm_creation_source,
    creation_context = COALESCE(p.creation_context, '{}'::jsonb) || jsonb_build_object(
      'form_submission_id', f.id,
      'form_id', f.form_id,
      'submitter_name', f.submitter_name,
      'submitter_email', f.submitter_email
    )
FROM public.pm_form_submissions f
WHERE f.created_project_id = p.id
  AND p.creation_source = 'unknown'::public.pm_creation_source;

UPDATE public.pm_tasks t
SET creation_source = (
      CASE
        WHEN f.submitter_email IS NOT NULL OR f.submitter_name IS NOT NULL THEN 'public_form'
        ELSE 'intake'
      END
    )::public.pm_creation_source,
    creation_context = COALESCE(t.creation_context, '{}'::jsonb) || jsonb_build_object(
      'form_submission_id', f.id,
      'form_id', f.form_id,
      'submitter_name', f.submitter_name,
      'submitter_email', f.submitter_email
    )
FROM public.pm_form_submissions f
WHERE f.created_task_id = t.id
  AND t.creation_source = 'unknown'::public.pm_creation_source;

UPDATE public.pm_tasks t
SET creation_source = p.creation_source,
    creation_context = COALESCE(t.creation_context, '{}'::jsonb) || jsonb_build_object(
      'inherited_from_project', true,
      'project_id', p.id
    )
FROM public.pm_projects p
WHERE t.project_id = p.id
  AND t.creation_source = 'unknown'::public.pm_creation_source
  AND p.creation_source IN ('public_form'::public.pm_creation_source, 'intake'::public.pm_creation_source);

UPDATE public.pm_tasks
SET creation_source = 'qa_batch'::public.pm_creation_source,
    creation_context = COALESCE(creation_context, '{}'::jsonb) || jsonb_build_object(
      'reported_by_name', custom_fields->'qa'->>'reported_by_name'
    )
WHERE creation_source = 'unknown'::public.pm_creation_source
  AND (
    (custom_fields->>'kind') = 'qa'
    OR (tags @> ARRAY['qa']::text[])
  );

UPDATE public.pm_tasks
SET creation_source = 'template'::public.pm_creation_source,
    creation_context = COALESCE(creation_context, '{}'::jsonb) || jsonb_build_object('define_pages', true)
WHERE creation_source = 'unknown'::public.pm_creation_source
  AND (custom_fields->>'define_pages') = 'true';

UPDATE public.pm_tasks
SET creation_source = 'page_generator'::public.pm_creation_source,
    creation_context = COALESCE(creation_context, '{}'::jsonb) || jsonb_build_object(
      'page_label', page_label,
      'page_group_key', page_group_key
    )
WHERE creation_source = 'unknown'::public.pm_creation_source
  AND page_label IS NOT NULL
  AND page_group_key IS NOT NULL
  AND page_group_key NOT LIKE 'reserved_%';

UPDATE public.pm_tasks t
SET creation_source = 'template'::public.pm_creation_source,
    creation_context = COALESCE(t.creation_context, '{}'::jsonb) || jsonb_build_object(
      'inherited_from_project', true,
      'template_id', p.template_id
    )
FROM public.pm_projects p
WHERE t.project_id = p.id
  AND t.creation_source = 'unknown'::public.pm_creation_source
  AND p.template_id IS NOT NULL
  AND t.created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_creation_source ON public.pm_tasks (creation_source);
CREATE INDEX IF NOT EXISTS idx_pm_projects_creation_source ON public.pm_projects (creation_source);

-- Schema additions
ALTER TABLE public.pm_template_tasks
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_duration_days integer,
  ADD COLUMN IF NOT EXISTS parallel_with_temp_id text,
  ADD COLUMN IF NOT EXISTS locked_to_kickoff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_to_go_live boolean NOT NULL DEFAULT false;

ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_duration_days integer,
  ADD COLUMN IF NOT EXISTS locked_to_kickoff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_to_go_live boolean NOT NULL DEFAULT false;

ALTER TABLE public.pm_projects
  ADD COLUMN IF NOT EXISTS kickoff_date date;

-- Seed Career Site template
DO $$
DECLARE
  tpl_id uuid;
BEGIN
  SELECT id INTO tpl_id FROM public.pm_project_templates WHERE name = 'Career Site' LIMIT 1;
  IF tpl_id IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.pm_project_templates (name, type, description, default_go_live_offset_days)
  VALUES ('Career Site', 'career_site', 'Standard career-site build: discovery → content → design → development → QA & launch.', 50)
  RETURNING id INTO tpl_id;

  -- Phase 1 — Discovery & Kickoff
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, role, assignee_role, phase_name, duration_days, min_duration_days, locked, locked_to_kickoff, sort_order) VALUES
    (tpl_id, 'kickoff_call',     'Kickoff call scheduled',          'review',   'pm', 'pm', 'Discovery & Kickoff', 1, 1, true,  true,  10),
    (tpl_id, 'discovery_sent',   'Discovery questionnaire sent',    'content',  'pm', 'pm', 'Discovery & Kickoff', 1, 1, false, false, 20),
    (tpl_id, 'discovery_back',   'Discovery questionnaire returned','content',  'pm', 'pm', 'Discovery & Kickoff', 3, 1, false, false, 30);

  -- Phase 2 — Content & Assets
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, role, assignee_role, phase_name, duration_days, min_duration_days, locked, sort_order, parallel_with_temp_id) VALUES
    (tpl_id, 'content_brief',    'Content brief sent to client',    'content',  'pm',       'pm',       'Content & Assets', 1, 1, false, 40, NULL),
    (tpl_id, 'copy_received',    'Copy/content received from client','content', 'pm',       'pm',       'Content & Assets', 5, 2, false, 50, NULL),
    (tpl_id, 'assets_received',  'Assets received (photos, logos, brand)','content','pm',  'pm',       'Content & Assets', 5, 2, false, 60, 'copy_received');

  -- Phase 3 — Design
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, role, assignee_role, phase_name, duration_days, min_duration_days, locked, sort_order) VALUES
    (tpl_id, 'wireframes',       'Wireframes / sitemap',            'design',   'designer', 'designer', 'Design',  3, 2, false, 70),
    (tpl_id, 'home_r1',          'Homepage design — Round 1',       'design',   'designer', 'designer', 'Design',  4, 3, false, 80),
    (tpl_id, 'review_r1',        'Client review — Round 1',         'review',   'pm',       'pm',       'Design',  3, 3, true,  90),
    (tpl_id, 'revisions_r1',     'Revisions — Round 1',             'design',   'designer', 'designer', 'Design',  2, 1, false, 100),
    (tpl_id, 'interior',         'Interior pages design',           'design',   'designer', 'designer', 'Design',  4, 3, false, 110),
    (tpl_id, 'review_r2',        'Client review — Round 2',         'review',   'pm',       'pm',       'Design',  3, 3, true,  120),
    (tpl_id, 'revisions_r2',     'Revisions — Round 2',             'design',   'designer', 'designer', 'Design',  2, 1, false, 130),
    (tpl_id, 'design_approval',  'Design approval',                 'approval', 'pm',       'pm',       'Design',  1, 1, true,  140);

  -- Phase 4 — Development
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, role, assignee_role, phase_name, duration_days, min_duration_days, locked, sort_order, parallel_with_temp_id) VALUES
    (tpl_id, 'dev_setup',        'Webflow / dev environment setup', 'dev',      'developer','developer','Development', 2, 2,  true,  150, NULL),
    (tpl_id, 'frontend_build',   'Frontend build',                  'dev',      'developer','developer','Development',10, 10, true,  160, NULL),
    (tpl_id, 'content_entry',    'Content entry',                   'content',  'developer','developer','Development', 3, 2,  false, 170, 'frontend_build'),
    (tpl_id, 'integrations',     'Integrations setup',              'dev',      'developer','developer','Development', 3, 2,  false, 180, 'frontend_build');

  -- Phase 5 — QA & Launch
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, role, assignee_role, phase_name, duration_days, min_duration_days, locked, locked_to_go_live, sort_order) VALUES
    (tpl_id, 'qa_internal',      'Internal QA',                     'qa',       'developer','developer','QA & Launch',  3, 3, true,  false, 190),
    (tpl_id, 'uat',              'Client UAT / final review',       'review',   'pm',       'pm',       'QA & Launch',  3, 3, true,  false, 200),
    (tpl_id, 'bug_fixes',        'Bug fixes',                       'dev',      'developer','developer','QA & Launch',  2, 1, false, false, 210),
    (tpl_id, 'launch',           'Go-live / launch',                'approval', 'developer','developer','QA & Launch',  1, 1, true,  true,  220);

  -- Dependencies (finish_start, sequential within sub-chains; parallel tasks share predecessor via parallel_with_temp_id)
  INSERT INTO public.pm_template_dependencies (template_id, from_temp_id, to_temp_id, type, lag_days) VALUES
    (tpl_id, 'kickoff_call',    'discovery_sent',   'finish_start', 0),
    (tpl_id, 'discovery_sent',  'discovery_back',   'finish_start', 0),
    (tpl_id, 'discovery_back',  'content_brief',    'finish_start', 0),
    (tpl_id, 'content_brief',   'copy_received',    'finish_start', 0),
    (tpl_id, 'content_brief',   'assets_received',  'finish_start', 0),
    (tpl_id, 'copy_received',   'wireframes',       'finish_start', 0),
    (tpl_id, 'assets_received', 'wireframes',       'finish_start', 0),
    (tpl_id, 'wireframes',      'home_r1',          'finish_start', 0),
    (tpl_id, 'home_r1',         'review_r1',        'finish_start', 0),
    (tpl_id, 'review_r1',       'revisions_r1',     'finish_start', 0),
    (tpl_id, 'revisions_r1',    'interior',         'finish_start', 0),
    (tpl_id, 'interior',        'review_r2',        'finish_start', 0),
    (tpl_id, 'review_r2',       'revisions_r2',     'finish_start', 0),
    (tpl_id, 'revisions_r2',    'design_approval',  'finish_start', 0),
    (tpl_id, 'design_approval', 'dev_setup',        'finish_start', 0),
    (tpl_id, 'dev_setup',       'frontend_build',   'finish_start', 0),
    (tpl_id, 'frontend_build',  'content_entry',    'start_start',  0),
    (tpl_id, 'frontend_build',  'integrations',     'start_start',  0),
    (tpl_id, 'frontend_build',  'qa_internal',      'finish_start', 0),
    (tpl_id, 'content_entry',   'qa_internal',      'finish_start', 0),
    (tpl_id, 'integrations',    'qa_internal',      'finish_start', 0),
    (tpl_id, 'qa_internal',     'uat',              'finish_start', 0),
    (tpl_id, 'uat',             'bug_fixes',        'finish_start', 0),
    (tpl_id, 'bug_fixes',       'launch',           'finish_start', 0);
END $$;
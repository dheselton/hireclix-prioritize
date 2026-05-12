DO $$
DECLARE
  v_template_id uuid;
BEGIN
  -- Find or create the Career Site template
  SELECT id INTO v_template_id FROM public.pm_project_templates WHERE name = 'Career Site' LIMIT 1;
  IF v_template_id IS NULL THEN
    INSERT INTO public.pm_project_templates (type, name, description, default_go_live_offset_days)
    VALUES ('career_site', 'Career Site', 'HireClix career site build (kickoff → go-live ~90 days)', 90)
    RETURNING id INTO v_template_id;
  ELSE
    UPDATE public.pm_project_templates
       SET default_go_live_offset_days = 90,
           description = 'HireClix career site build (kickoff → go-live ~90 days)',
           type = 'career_site'
     WHERE id = v_template_id;
  END IF;

  -- Wipe existing template rows for clean reseed
  DELETE FROM public.pm_template_dependencies WHERE template_id = v_template_id;
  DELETE FROM public.pm_template_tasks WHERE template_id = v_template_id;

  -- ===== Phase 1: Pre-Kickoff Activities =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked, locked_to_kickoff, locked_to_go_live) VALUES
    (v_template_id, 'pk_email_finance',  'Email Finance',                                 'review',   'pm',        'Pre-Kickoff Activities',  10, 1, 1, true,  true,  false),
    (v_template_id, 'pk_sow',             'Statement of Work / Proposal',                  'review',   'pm',        'Pre-Kickoff Activities',  20, 5, 3, false, false, false),
    (v_template_id, 'pk_assign',          'Assign Account Manager & Implementation team',  'review',   'pm',        'Pre-Kickoff Activities',  30, 1, 1, true,  false, false),
    (v_template_id, 'pk_reqs',            'Finalize client requirements',                  'review',   'pm',        'Pre-Kickoff Activities',  40, 3, 2, false, false, false),
    (v_template_id, 'pk_rates',           'Negotiate rates and schedule',                  'review',   'pm',        'Pre-Kickoff Activities',  50, 2, 1, false, false, false),
    (v_template_id, 'pk_sign',            'Sign contract',                                 'approval', 'pm',        'Pre-Kickoff Activities',  60, 2, 1, true,  false, false),
    (v_template_id, 'pk_handoff_sched',   'Internal handoff — schedule',                   'review',   'pm',        'Pre-Kickoff Activities',  70, 1, 1, true,  false, false),
    (v_template_id, 'pk_handoff_meet',    'Internal handoff — conduct meeting',            'review',   'pm',        'Pre-Kickoff Activities',  80, 1, 1, true,  false, false),
    (v_template_id, 'pk_pmintro_sched',   'PM Introduction — schedule',                    'review',   'pm',        'Pre-Kickoff Activities',  90, 1, 1, true,  false, false),
    (v_template_id, 'pk_pmintro_meet',    'PM Introduction — conduct meeting',             'review',   'pm',        'Pre-Kickoff Activities', 100, 1, 1, true,  false, false),
    (v_template_id, 'pk_evp',             'Client provides EVP documentation',             'content',  'submitter', 'Pre-Kickoff Activities', 110, 5, 2, false, false, false),
    (v_template_id, 'pk_brand',           'Client provides brand guidelines, fonts & logo','content',  'submitter', 'Pre-Kickoff Activities', 120, 5, 2, false, false, false),
    (v_template_id, 'pk_inspo',           'Client provides inspiration sites & feedback',  'content',  'submitter', 'Pre-Kickoff Activities', 130, 5, 2, false, false, false),
    (v_template_id, 'pk_currentfb',       'Current career site feedback',                  'content',  'submitter', 'Pre-Kickoff Activities', 140, 3, 2, false, false, false),
    (v_template_id, 'pk_setup_cu',        'Create ClickUp / project workspace',            'review',   'pm',        'Pre-Kickoff Activities', 150, 1, 1, true,  false, false),
    (v_template_id, 'pk_setup_plan',      'Create project plan',                           'review',   'pm',        'Pre-Kickoff Activities', 160, 1, 1, true,  false, false),
    (v_template_id, 'pk_setup_raid',      'Create RAID log',                               'review',   'pm',        'Pre-Kickoff Activities', 170, 1, 1, true,  false, false),
    (v_template_id, 'pk_setup_chat',      'Create Google Chat space',                      'review',   'pm',        'Pre-Kickoff Activities', 180, 1, 1, true,  false, false),
    (v_template_id, 'pk_setup_drive',     'Create Google Drive folder',                    'review',   'pm',        'Pre-Kickoff Activities', 190, 1, 1, true,  false, false);

  -- ===== Phase 2: Project Kickoff =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'ko_sched', 'Schedule kickoff call', 'review', 'pm', 'Project Kickoff', 200, 2, 1, true),
    (v_template_id, 'ko_call',  'Kickoff call',          'review', 'pm', 'Project Kickoff', 210, 1, 1, true);

  -- ===== Phase 3: Discovery =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'dc1', 'Discovery Call #1 — Current site / brand alignment', 'review', 'pm', 'Discovery', 300, 1, 1, true),
    (v_template_id, 'dc2', 'Discovery Call #2 — Inspiration site review',        'review', 'pm', 'Discovery', 310, 1, 1, true),
    (v_template_id, 'dc3', 'Discovery Call #3 — Pages, assets & copy',           'review', 'pm', 'Discovery', 320, 1, 1, true);

  -- ===== Phase 4: Integration =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'in_kickoff', 'Integration kick-off',         'review', 'developer', 'Integration', 400, 1,  1, true),
    (v_template_id, 'in_mapping', 'Integration mapping meeting',  'review', 'developer', 'Integration', 410, 2,  1, true),
    (v_template_id, 'in_build',   'Integration build',            'dev',    'developer', 'Integration', 420, 12, 7, false),
    (v_template_id, 'in_test',    'Integration testing',          'qa',     'developer', 'Integration', 430, 5,  3, false);

  -- ===== Phase 5: Concept =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'cn_create',   'Create concept',                              'design',   'designer',  'Concept', 500, 7, 5, false),
    (v_template_id, 'cn_present',  'Present concept mock-up (Round 1)',           'review',   'designer',  'Concept', 510, 1, 1, true),
    (v_template_id, 'cn_clientfb', 'Client provides concept feedback (Round 1)',  'content',  'submitter', 'Concept', 520, 4, 3, false),
    (v_template_id, 'cn_review',   'Feedback review meeting (Round 1)',           'review',   'pm',        'Concept', 530, 1, 1, true);

  -- ===== Phase 6: Design =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'dz_mockup',   'Design mock-up',                              'design',   'designer',  'Design', 600, 8, 5, false),
    (v_template_id, 'dz_present',  'Present mock-up (Round 1)',                   'review',   'designer',  'Design', 610, 1, 1, true),
    (v_template_id, 'dz_clientfb', 'Client provides mock-up feedback (Round 1)',  'content',  'submitter', 'Design', 620, 4, 3, false),
    (v_template_id, 'dz_review',   'Feedback review meeting (Round 1)',           'review',   'pm',        'Design', 630, 1, 1, true);

  -- ===== Phase 7: Build =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'bd_build',     'Career site build',                  'dev',    'developer', 'Build', 700, 14, 8, false),
    (v_template_id, 'bd_analytics', 'Submit analytics ticket — events',   'dev',    'developer', 'Build', 710, 2,  1, false);

  -- ===== Phase 8: GLAAT =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'gl_kickoff',         'GLAAT kick-off meeting',                    'review',   'pm',        'GLAAT', 800, 1, 1, true),
    (v_template_id, 'gl_uat',             'User Acceptance Testing (UAT)',             'qa',       'pm',        'GLAAT', 810, 5, 5, true),
    (v_template_id, 'gl_signoff',         'GLAAT sign-off',                            'approval', 'pm',        'GLAAT', 820, 2, 1, true),
    (v_template_id, 'gl_dashboard',       'Submit analytics dashboard ticket',         'dev',      'developer', 'GLAAT', 830, 1, 1, false),
    (v_template_id, 'gl_transitionprep',  'Schedule internal transition prep meeting', 'review',   'pm',        'GLAAT', 840, 1, 1, true);

  -- ===== Phase 9: Go Live =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked, locked_to_go_live) VALUES
    (v_template_id, 'go_dns',  'Technical resource completes DNS updates', 'dev',    'developer', 'Go Live', 900, 1, 1, true, false),
    (v_template_id, 'go_push', 'Push site to production',                  'dev',    'developer', 'Go Live', 910, 1, 1, true, false),
    (v_template_id, 'go_live', 'Go Live!',                                 'review', 'pm',        'Go Live', 920, 1, 1, true, true);

  -- ===== Phase 10: Transition =====
  INSERT INTO public.pm_template_tasks (template_id, temp_id, title, type, assignee_role, phase_name, sort_order, duration_days, min_duration_days, locked) VALUES
    (v_template_id, 'tr_support', 'Post go-live support calls', 'review', 'pm', 'Transition', 1000, 5, 3, false);

  -- ===== Dependencies (finish_start; lag_days = client-scheduling buffer) =====
  INSERT INTO public.pm_template_dependencies (template_id, from_temp_id, to_temp_id, type, lag_days) VALUES
    -- Phase 1
    (v_template_id, 'pk_email_finance', 'pk_sow',           'finish_start', 0),
    (v_template_id, 'pk_sow',           'pk_assign',        'finish_start', 0),
    (v_template_id, 'pk_sow',           'pk_reqs',          'finish_start', 0),
    (v_template_id, 'pk_reqs',          'pk_rates',         'finish_start', 0),
    (v_template_id, 'pk_rates',         'pk_sign',          'finish_start', 0),
    (v_template_id, 'pk_sign',          'pk_handoff_sched', 'finish_start', 0),
    (v_template_id, 'pk_handoff_sched', 'pk_handoff_meet',  'finish_start', 3),
    (v_template_id, 'pk_handoff_meet',  'pk_pmintro_sched', 'finish_start', 0),
    (v_template_id, 'pk_pmintro_sched', 'pk_pmintro_meet',  'finish_start', 5),
    (v_template_id, 'pk_pmintro_meet',  'pk_evp',           'finish_start', 0),
    (v_template_id, 'pk_pmintro_meet',  'pk_brand',         'finish_start', 0),
    (v_template_id, 'pk_pmintro_meet',  'pk_inspo',         'finish_start', 0),
    (v_template_id, 'pk_pmintro_meet',  'pk_currentfb',     'finish_start', 0),
    (v_template_id, 'pk_sign',          'pk_setup_cu',      'finish_start', 0),
    (v_template_id, 'pk_sign',          'pk_setup_plan',    'finish_start', 0),
    (v_template_id, 'pk_sign',          'pk_setup_raid',    'finish_start', 0),
    (v_template_id, 'pk_sign',          'pk_setup_chat',    'finish_start', 0),
    (v_template_id, 'pk_sign',          'pk_setup_drive',   'finish_start', 0),
    -- Phase 2
    (v_template_id, 'pk_pmintro_meet',  'ko_sched',         'finish_start', 0),
    (v_template_id, 'ko_sched',         'ko_call',          'finish_start', 5),
    -- Phase 3
    (v_template_id, 'ko_call',          'dc1',              'finish_start', 5),
    (v_template_id, 'dc1',              'dc2',              'finish_start', 5),
    (v_template_id, 'dc2',              'dc3',              'finish_start', 5),
    -- Phase 4
    (v_template_id, 'dc3',              'in_kickoff',       'finish_start', 5),
    (v_template_id, 'in_kickoff',       'in_mapping',       'finish_start', 3),
    (v_template_id, 'in_mapping',       'in_build',         'finish_start', 0),
    (v_template_id, 'in_build',         'in_test',          'finish_start', 0),
    -- Phase 5
    (v_template_id, 'dc3',              'cn_create',        'finish_start', 0),
    (v_template_id, 'cn_create',        'cn_present',       'finish_start', 5),
    (v_template_id, 'cn_present',       'cn_clientfb',      'finish_start', 0),
    (v_template_id, 'cn_clientfb',      'cn_review',        'finish_start', 3),
    -- Phase 6
    (v_template_id, 'cn_review',        'dz_mockup',        'finish_start', 0),
    (v_template_id, 'dz_mockup',        'dz_present',       'finish_start', 5),
    (v_template_id, 'dz_present',       'dz_clientfb',      'finish_start', 0),
    (v_template_id, 'dz_clientfb',      'dz_review',        'finish_start', 3),
    -- Phase 7
    (v_template_id, 'dz_review',        'bd_build',         'finish_start', 0),
    (v_template_id, 'dz_review',        'bd_analytics',     'finish_start', 0),
    -- Phase 8
    (v_template_id, 'bd_build',         'gl_kickoff',       'finish_start', 5),
    (v_template_id, 'in_test',          'gl_kickoff',       'finish_start', 0),
    (v_template_id, 'gl_kickoff',       'gl_uat',           'finish_start', 0),
    (v_template_id, 'gl_uat',           'gl_signoff',       'finish_start', 3),
    (v_template_id, 'gl_signoff',       'gl_dashboard',     'finish_start', 0),
    (v_template_id, 'gl_signoff',       'gl_transitionprep','finish_start', 0),
    -- Phase 9
    (v_template_id, 'gl_signoff',       'go_dns',           'finish_start', 0),
    (v_template_id, 'go_dns',           'go_push',          'finish_start', 0),
    (v_template_id, 'go_push',          'go_live',          'finish_start', 0),
    -- Phase 10
    (v_template_id, 'go_live',          'tr_support',       'finish_start', 0);
END $$;
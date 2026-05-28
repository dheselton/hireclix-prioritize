
-- 1. Add is_internal flag to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- 2. Upsert HireClix internal client
INSERT INTO public.clients (name, is_internal)
SELECT 'HireClix', true
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE lower(name) = 'hireclix');

UPDATE public.clients SET is_internal = true WHERE lower(name) = 'hireclix';

-- 3. Seed new internal request form types (idempotent)
WITH inserted AS (
  INSERT INTO public.pm_forms (name, kind, request_type, submit_action)
  SELECT v.name, 'internal_request', v.rt, '{"creates":"task"}'::jsonb
  FROM (VALUES
    ('New Landing Page Request',     'landing_page'),
    ('Career Site Update Request',   'careersite_update'),
    ('Job Description Request',      'job_description'),
    ('Recruiter Collateral Request', 'recruiter_collateral'),
    ('Event Collateral Request',     'event_collateral'),
    ('Presentation Request',         'presentation'),
    ('Video Edit Request',           'video_edit'),
    ('Photo Retouch Request',        'photo_retouch'),
    ('Print Collateral Request',     'print_collateral'),
    ('Swag / Apparel Request',       'swag_apparel'),
    ('Infographic Request',          'infographic'),
    ('Brand Asset Request',          'brand_assets'),
    ('Copywriting Request',          'copywriting')
  ) AS v(name, rt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pm_forms f WHERE f.kind='internal_request' AND f.request_type = v.rt
  )
  RETURNING id, request_type
)
INSERT INTO public.pm_form_fields (form_id, label, type, required, sort_order, options, placeholder)
SELECT i.id, fld.label, fld.type, fld.required, fld.sort_order, fld.options::jsonb, fld.placeholder
FROM inserted i
JOIN (VALUES
  -- landing_page
  ('landing_page','Page URL slug',       'text',     true,  10, '[]', '/careers/landing-name'),
  ('landing_page','Audience',            'text',     true,  20, '[]', 'Who is this for?'),
  ('landing_page','Primary goal / CTA',  'text',     true,  30, '[]', 'Apply now, Learn more…'),
  ('landing_page','Copy doc link',       'text',     false, 40, '[]', 'Google Doc / Notion'),
  ('landing_page','Brand assets link',   'text',     false, 50, '[]', 'Logos, fonts, photography'),
  ('landing_page','Launch date',         'date',     false, 60, '[]', NULL),
  ('landing_page','Priority',            'dropdown', false, 70, '["low","medium","high","urgent"]', NULL),
  -- careersite_update
  ('careersite_update','Page URL',       'text',     true,  10, '[]', 'https://careers.example.com/page'),
  ('careersite_update','Change description','textarea',true,20, '[]', 'What needs to change?'),
  ('careersite_update','Asset link',     'text',     false, 30, '[]', 'Dropbox / Drive / Figma'),
  ('careersite_update','Priority',       'dropdown', false, 40, '["low","medium","high","urgent"]', NULL),
  -- job_description
  ('job_description','Role title',       'text',     true,  10, '[]', 'Senior Recruiter'),
  ('job_description','Current JD link',  'text',     false, 20, '[]', 'Link to existing JD'),
  ('job_description','Tone',             'dropdown', false, 30, '["formal","conversational","bold","inclusive"]', NULL),
  ('job_description','Deadline',         'date',     false, 40, '[]', NULL),
  -- recruiter_collateral
  ('recruiter_collateral','Audience',    'text',     true,  10, '[]', 'Candidates, hiring managers…'),
  ('recruiter_collateral','Key messages','textarea', true,  20, '[]', 'Bullet the must-include messages'),
  ('recruiter_collateral','Format',      'dropdown', true,  30, '["one-pager","sell sheet","slide","email"]', NULL),
  ('recruiter_collateral','Brand assets link','text',false,40, '[]', NULL),
  ('recruiter_collateral','Deadline',    'date',     false, 50, '[]', NULL),
  -- event_collateral
  ('event_collateral','Event name',      'text',     true,  10, '[]', 'SHRM 2026'),
  ('event_collateral','Event date',      'date',     true,  20, '[]', NULL),
  ('event_collateral','Deliverables',    'textarea', true,  30, '[]', 'Booth banner, flyers, swag…'),
  ('event_collateral','Brand assets link','text',    false, 40, '[]', NULL),
  ('event_collateral','Ship-by date',    'date',     false, 50, '[]', NULL),
  -- presentation
  ('presentation','Audience',            'text',     true,  10, '[]', 'Internal exec, client pitch…'),
  ('presentation','Estimated slide count','text',    false, 20, '[]', 'e.g. 12-15'),
  ('presentation','Source content link', 'text',     false, 30, '[]', 'Outline / doc / deck'),
  ('presentation','Due date',            'date',     false, 40, '[]', NULL),
  -- video_edit
  ('video_edit','Source footage link',   'text',     true,  10, '[]', 'Drive / Dropbox / Frame.io'),
  ('video_edit','Target length',         'text',     false, 20, '[]', 'e.g. 60s, 2min'),
  ('video_edit','Captions required',     'dropdown', false, 30, '["yes","no"]', NULL),
  ('video_edit','Output format',         'dropdown', false, 40, '["16:9","9:16","1:1"]', NULL),
  ('video_edit','Due date',              'date',     false, 50, '[]', NULL),
  -- photo_retouch
  ('photo_retouch','Asset link',         'text',     true,  10, '[]', 'Drive / Dropbox'),
  ('photo_retouch','Edits needed',       'textarea', true,  20, '[]', 'Describe retouching'),
  ('photo_retouch','Output specs',       'text',     false, 30, '[]', 'Size, format, color profile'),
  ('photo_retouch','Due date',           'date',     false, 40, '[]', NULL),
  -- print_collateral
  ('print_collateral','Piece type',      'dropdown', true,  10, '["flyer","brochure","postcard","poster","other"]', NULL),
  ('print_collateral','Dimensions',      'text',     true,  20, '[]', '8.5x11, 4x6…'),
  ('print_collateral','Bleed required',  'dropdown', false, 30, '["yes","no"]', NULL),
  ('print_collateral','Quantity',        'text',     false, 40, '[]', '500, 1000…'),
  ('print_collateral','Ship-by date',    'date',     false, 50, '[]', NULL),
  -- swag_apparel
  ('swag_apparel','Item type',           'text',     true,  10, '[]', 'T-shirt, hat, sticker…'),
  ('swag_apparel','Quantity',            'text',     false, 20, '[]', NULL),
  ('swag_apparel','Colors',              'text',     false, 30, '[]', 'Garment + print colors'),
  ('swag_apparel','Vendor link',         'text',     false, 40, '[]', 'Vendor / store URL'),
  ('swag_apparel','Need-by date',        'date',     false, 50, '[]', NULL),
  -- infographic
  ('infographic','Data source link',     'text',     true,  10, '[]', 'Sheet / doc / report'),
  ('infographic','Key stats',            'textarea', true,  20, '[]', 'List the must-show numbers'),
  ('infographic','Format',               'dropdown', false, 30, '["square","portrait","landscape","story"]', NULL),
  ('infographic','Due date',             'date',     false, 40, '[]', NULL),
  -- brand_assets
  ('brand_assets','Use case',            'textarea', true,  10, '[]', 'Where will this be used?'),
  ('brand_assets','Formats needed',      'text',     true,  20, '[]', 'PNG, SVG, AI, EPS…'),
  ('brand_assets','Due date',            'date',     false, 30, '[]', NULL),
  -- copywriting
  ('copywriting','Channel',              'dropdown', true,  10, '["web","email","social","ad","print"]', NULL),
  ('copywriting','Audience',             'text',     true,  20, '[]', 'Who reads this?'),
  ('copywriting','Word count target',    'text',     false, 30, '[]', 'e.g. 150-200'),
  ('copywriting','Tone',                 'dropdown', false, 40, '["formal","conversational","bold","inclusive"]', NULL),
  ('copywriting','Deadline',             'date',     false, 50, '[]', NULL)
) AS fld(rt, label, type, required, sort_order, options, placeholder)
  ON fld.rt = i.request_type;

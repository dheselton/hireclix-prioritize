
ALTER TABLE public.pm_forms
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS request_type text;

CREATE INDEX IF NOT EXISTS pm_forms_kind_request_type_idx
  ON public.pm_forms(kind, request_type);

-- Seed internal forms (idempotent on request_type)
WITH ins AS (
  INSERT INTO public.pm_forms (name, kind, request_type, submit_action)
  SELECT v.name, 'internal_request', v.rt, '{"creates":"project"}'::jsonb
  FROM (VALUES
    ('Web Edit Request',   'web_edit'),
    ('Banner Ads Request', 'banner_ads'),
    ('Social Post Request','social'),
    ('Email Request',      'email'),
    ('General Request',    'general')
  ) AS v(name, rt)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pm_forms f WHERE f.kind='internal_request' AND f.request_type = v.rt
  )
  RETURNING id, request_type
)
INSERT INTO public.pm_form_fields (form_id, label, type, required, sort_order, options, placeholder)
SELECT i.id, fld.label, fld.type, fld.required, fld.sort_order, fld.options::jsonb, fld.placeholder
FROM ins i
JOIN LATERAL (
  SELECT * FROM (VALUES
    -- web_edit
    ('web_edit',  'Page URL',           'text',     true,  10, '[]', 'https://example.com/page'),
    ('web_edit',  'Change description', 'textarea', true,  20, '[]', 'What needs to change?'),
    ('web_edit',  'Asset link',         'text',     false, 30, '[]', 'Dropbox / Drive / Figma'),
    ('web_edit',  'Priority',           'dropdown', false, 40, '["low","medium","high","urgent"]', NULL),
    -- banner_ads
    ('banner_ads','Sizes',              'checkbox_group', true, 10, '["300x250","728x90","160x600","320x50","300x600","970x250"]', NULL),
    ('banner_ads','Ad copy',            'textarea', true,  20, '[]', 'Headline + CTA'),
    ('banner_ads','Landing URL',        'text',     true,  30, '[]', 'https://...'),
    ('banner_ads','Brand assets link',  'text',     false, 40, '[]', 'Logos / fonts / colors'),
    ('banner_ads','Run start date',     'date',     false, 50, '[]', NULL),
    ('banner_ads','Run end date',       'date',     false, 60, '[]', NULL),
    -- social
    ('social',    'Platforms',          'checkbox_group', true, 10, '["LinkedIn","Instagram","Facebook","X/Twitter","TikTok","YouTube"]', NULL),
    ('social',    'Caption',            'textarea', true,  20, '[]', 'Post copy'),
    ('social',    'Asset link',         'text',     false, 30, '[]', 'Image/video URL'),
    ('social',    'Post date',          'date',     false, 40, '[]', NULL),
    -- email
    ('email',     'Subject line',       'text',     true,  10, '[]', NULL),
    ('email',     'Audience',           'text',     true,  20, '[]', 'Segment / list name'),
    ('email',     'Send date',          'date',     false, 30, '[]', NULL),
    ('email',     'Asset link',         'text',     false, 40, '[]', 'Hero image / copy doc'),
    -- general
    ('general',   'Notes',              'textarea', false, 10, '[]', 'Any extra context')
  ) AS t(rt, label, type, required, sort_order, options, placeholder)
) fld ON fld.rt = i.request_type;

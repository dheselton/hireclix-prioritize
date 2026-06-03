ALTER TABLE pm_template_dependencies
  ADD COLUMN reveal_mode text NOT NULL DEFAULT 'on_complete'
  CHECK (reveal_mode IN ('on_complete','on_start','always'));

ALTER TABLE pm_task_dependencies
  ADD COLUMN reveal_mode text NOT NULL DEFAULT 'on_complete'
  CHECK (reveal_mode IN ('on_complete','on_start','always'));
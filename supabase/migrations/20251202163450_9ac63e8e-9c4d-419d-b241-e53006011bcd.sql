-- Drop the existing status check constraint
ALTER TABLE public.features DROP CONSTRAINT IF EXISTS features_status_check;

-- Add new check constraint with expanded status options
ALTER TABLE public.features ADD CONSTRAINT features_status_check 
CHECK (status IN (
  'Scope/Ideation', 
  'Design', 
  'In Development', 
  'QA', 
  'Approved', 
  'Released',
  'Backlog',
  'Discovery',
  'In Design',
  'Ready for Dev',
  'In Dev',
  'Ready for Rollout',
  'Rolled Out',
  'On Hold',
  'Cancelled'
));
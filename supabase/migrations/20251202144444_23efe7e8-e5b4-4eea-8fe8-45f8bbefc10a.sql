-- Create team_members table to store team member info
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Allow all access (no auth required for this internal tool)
CREATE POLICY "Allow all access to team_members" 
ON public.team_members 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert the career site team members
INSERT INTO public.team_members (name, email, role) VALUES
  ('Dan Heselton', 'dan.heselton@hireclix.com', 'Career Site Team'),
  ('Riley Mulligan', 'riley.mulligan@hireclix.com', 'Career Site Team'),
  ('Lisa Thompson', 'lisa.thompson@hireclix.com', 'Career Site Team');
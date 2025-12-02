-- Drop all existing permissive "Allow all access" policies
DROP POLICY IF EXISTS "Allow all access to activities" ON public.activities;
DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all access to docs" ON public.docs;
DROP POLICY IF EXISTS "Allow all access to features" ON public.features;
DROP POLICY IF EXISTS "Allow all access to integrations" ON public.integrations;
DROP POLICY IF EXISTS "Allow all access to job_api_logs" ON public.job_api_logs;
DROP POLICY IF EXISTS "Allow all access to loom_videos" ON public.loom_videos;
DROP POLICY IF EXISTS "Allow all access to product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Allow all access to release_versions" ON public.release_versions;
DROP POLICY IF EXISTS "Allow all access to team_members" ON public.team_members;

-- Create proper authentication-based RLS policies for each table

-- ACTIVITIES: Only authenticated users can access
CREATE POLICY "Authenticated users can view activities"
ON public.activities FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert activities"
ON public.activities FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update activities"
ON public.activities FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete activities"
ON public.activities FOR DELETE
TO authenticated
USING (true);

-- CUSTOMERS: Only authenticated users can access
CREATE POLICY "Authenticated users can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete customers"
ON public.customers FOR DELETE
TO authenticated
USING (true);

-- DOCS: Only authenticated users can access
CREATE POLICY "Authenticated users can view docs"
ON public.docs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert docs"
ON public.docs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update docs"
ON public.docs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete docs"
ON public.docs FOR DELETE
TO authenticated
USING (true);

-- FEATURES: Only authenticated users can access
CREATE POLICY "Authenticated users can view features"
ON public.features FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert features"
ON public.features FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update features"
ON public.features FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete features"
ON public.features FOR DELETE
TO authenticated
USING (true);

-- INTEGRATIONS: Only authenticated users can access
CREATE POLICY "Authenticated users can view integrations"
ON public.integrations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert integrations"
ON public.integrations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update integrations"
ON public.integrations FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete integrations"
ON public.integrations FOR DELETE
TO authenticated
USING (true);

-- JOB_API_LOGS: Only authenticated users can access
CREATE POLICY "Authenticated users can view job_api_logs"
ON public.job_api_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert job_api_logs"
ON public.job_api_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update job_api_logs"
ON public.job_api_logs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete job_api_logs"
ON public.job_api_logs FOR DELETE
TO authenticated
USING (true);

-- LOOM_VIDEOS: Only authenticated users can access
CREATE POLICY "Authenticated users can view loom_videos"
ON public.loom_videos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert loom_videos"
ON public.loom_videos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update loom_videos"
ON public.loom_videos FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete loom_videos"
ON public.loom_videos FOR DELETE
TO authenticated
USING (true);

-- PRODUCT_CATEGORIES: Only authenticated users can access
CREATE POLICY "Authenticated users can view product_categories"
ON public.product_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert product_categories"
ON public.product_categories FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update product_categories"
ON public.product_categories FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete product_categories"
ON public.product_categories FOR DELETE
TO authenticated
USING (true);

-- RELEASE_VERSIONS: Only authenticated users can access
CREATE POLICY "Authenticated users can view release_versions"
ON public.release_versions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert release_versions"
ON public.release_versions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update release_versions"
ON public.release_versions FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete release_versions"
ON public.release_versions FOR DELETE
TO authenticated
USING (true);

-- TEAM_MEMBERS: Only authenticated users can access (contains employee emails)
CREATE POLICY "Authenticated users can view team_members"
ON public.team_members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert team_members"
ON public.team_members FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update team_members"
ON public.team_members FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete team_members"
ON public.team_members FOR DELETE
TO authenticated
USING (true);
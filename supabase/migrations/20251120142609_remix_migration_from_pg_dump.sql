--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_loom_videos_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_loom_videos_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    summary text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    actor text NOT NULL,
    CONSTRAINT activities_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'status_changed'::text, 'note_added'::text]))),
    CONSTRAINT activities_type_check CHECK ((type = ANY (ARRAY['customer'::text, 'doc'::text, 'integration'::text])))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    ats text NOT NULL,
    go_live_date text,
    live_sites integer DEFAULT 0,
    region text,
    segment text,
    owner text,
    site_url text,
    dashboard_url text,
    notes text DEFAULT ''::text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['Prospect'::text, 'In Progress'::text, 'Live'::text, 'Paused'::text, 'Retired'::text]))),
    CONSTRAINT customers_type_check CHECK ((type = ANY (ARRAY['Career Site'::text, 'JobFlow SEO'::text])))
);


--
-- Name: docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    description text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    owner text,
    type text NOT NULL,
    audience text NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    views_30d integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT docs_audience_check CHECK ((audience = ANY (ARRAY['internal'::text, 'client'::text]))),
    CONSTRAINT docs_type_check CHECK ((type = ANY (ARRAY['one-pager'::text, 'implementation'::text, 'how-to'::text, 'integration'::text, 'design'::text, 'other'::text])))
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    vendor text NOT NULL,
    category text NOT NULL,
    status text NOT NULL,
    version text,
    docs_link text,
    owner text,
    known_limitations text DEFAULT ''::text,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    health text DEFAULT 'Healthy'::text NOT NULL,
    directionality text DEFAULT 'Unidirectional'::text NOT NULL,
    capabilities text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integrations_category_check CHECK ((category = ANY (ARRAY['ATS'::text, 'Analytics'::text, 'SEO'::text, 'SSO'::text, 'CDN'::text, 'Other'::text]))),
    CONSTRAINT integrations_directionality_check CHECK ((directionality = ANY (ARRAY['Unidirectional'::text, 'Bidirectional'::text, 'Mixed'::text]))),
    CONSTRAINT integrations_health_check CHECK ((health = ANY (ARRAY['Healthy'::text, 'Degraded'::text, 'Down'::text]))),
    CONSTRAINT integrations_status_check CHECK ((status = ANY (ARRAY['GA'::text, 'Beta'::text, 'Planned'::text, 'Deprecated'::text])))
);


--
-- Name: job_api_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_api_logs (
    id bigint NOT NULL,
    company_name text NOT NULL,
    push_id integer NOT NULL,
    push_timestamp timestamp with time zone NOT NULL,
    total_jobs_processed integer DEFAULT 0 NOT NULL,
    jobs_created integer DEFAULT 0 NOT NULL,
    jobs_updated integer DEFAULT 0 NOT NULL,
    jobs_deleted integer DEFAULT 0 NOT NULL,
    total_errors integer DEFAULT 0 NOT NULL,
    push_error_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    execution_time_seconds integer DEFAULT 0 NOT NULL,
    push_status text NOT NULL,
    push_additional_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    record_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: get_job_api_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_job_api_stats() RETURNS TABLE(total_pushes bigint, successful_pushes bigint, failed_pushes bigint, total_jobs_processed bigint, total_errors bigint, avg_execution_time numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    COUNT(*)::bigint as total_pushes,
    COUNT(*) FILTER (WHERE push_status = 'SUCCESS')::bigint as successful_pushes,
    COUNT(*) FILTER (WHERE push_status != 'SUCCESS')::bigint as failed_pushes,
    COALESCE(SUM(total_jobs_processed), 0)::bigint as total_jobs_processed,
    COALESCE(SUM(total_errors), 0)::bigint as total_errors,
    COALESCE(AVG(execution_time_seconds), 0)::numeric as avg_execution_time
  FROM public.job_api_logs;
$$;


--
-- Name: loom_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loom_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    loom_url text NOT NULL,
    description text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    thumbnail_url text,
    duration text,
    view_count integer DEFAULT 0,
    is_pinned boolean DEFAULT false,
    folder text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: docs docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: job_api_logs job_api_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_api_logs
    ADD CONSTRAINT job_api_logs_pkey PRIMARY KEY (id);


--
-- Name: loom_videos loom_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loom_videos
    ADD CONSTRAINT loom_videos_pkey PRIMARY KEY (id);


--
-- Name: idx_job_api_logs_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_api_logs_company_name ON public.job_api_logs USING btree (company_name);


--
-- Name: idx_job_api_logs_push_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_api_logs_push_status ON public.job_api_logs USING btree (push_status);


--
-- Name: idx_job_api_logs_push_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_api_logs_push_timestamp ON public.job_api_logs USING btree (push_timestamp DESC);


--
-- Name: idx_job_api_logs_total_errors; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_api_logs_total_errors ON public.job_api_logs USING btree (total_errors);


--
-- Name: idx_loom_videos_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loom_videos_folder ON public.loom_videos USING btree (folder);


--
-- Name: idx_loom_videos_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loom_videos_pinned ON public.loom_videos USING btree (is_pinned);


--
-- Name: idx_loom_videos_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loom_videos_tags ON public.loom_videos USING gin (tags);


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: integrations update_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loom_videos update_loom_videos_last_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loom_videos_last_updated BEFORE UPDATE ON public.loom_videos FOR EACH ROW EXECUTE FUNCTION public.update_loom_videos_timestamp();


--
-- Name: activities Allow all access to activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to activities" ON public.activities USING (true) WITH CHECK (true);


--
-- Name: customers Allow all access to customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to customers" ON public.customers USING (true) WITH CHECK (true);


--
-- Name: docs Allow all access to docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to docs" ON public.docs USING (true) WITH CHECK (true);


--
-- Name: integrations Allow all access to integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to integrations" ON public.integrations USING (true) WITH CHECK (true);


--
-- Name: job_api_logs Allow all access to job_api_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to job_api_logs" ON public.job_api_logs USING (true) WITH CHECK (true);


--
-- Name: loom_videos Allow all access to loom_videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to loom_videos" ON public.loom_videos USING (true) WITH CHECK (true);


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: docs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: job_api_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_api_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: loom_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loom_videos ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



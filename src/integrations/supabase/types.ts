export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          action: string
          actor: string
          entity_id: string
          id: string
          summary: string
          timestamp: string
          type: string
        }
        Insert: {
          action: string
          actor: string
          entity_id: string
          id?: string
          summary: string
          timestamp?: string
          type: string
        }
        Update: {
          action?: string
          actor?: string
          entity_id?: string
          id?: string
          summary?: string
          timestamp?: string
          type?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          ats: string
          created_at: string
          dashboard_url: string | null
          go_live_date: string | null
          id: string
          live_sites: number | null
          name: string
          notes: string | null
          owner: string | null
          region: string | null
          segment: string | null
          site_url: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          ats: string
          created_at?: string
          dashboard_url?: string | null
          go_live_date?: string | null
          id?: string
          live_sites?: number | null
          name: string
          notes?: string | null
          owner?: string | null
          region?: string | null
          segment?: string | null
          site_url?: string | null
          status: string
          type: string
          updated_at?: string
        }
        Update: {
          ats?: string
          created_at?: string
          dashboard_url?: string | null
          go_live_date?: string | null
          id?: string
          live_sites?: number | null
          name?: string
          notes?: string | null
          owner?: string | null
          region?: string | null
          segment?: string | null
          site_url?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      docs: {
        Row: {
          audience: string
          created_at: string
          description: string
          id: string
          last_updated: string
          owner: string | null
          tags: string[] | null
          title: string
          type: string
          url: string
          views_30d: number | null
        }
        Insert: {
          audience: string
          created_at?: string
          description: string
          id?: string
          last_updated?: string
          owner?: string | null
          tags?: string[] | null
          title: string
          type: string
          url: string
          views_30d?: number | null
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string
          id?: string
          last_updated?: string
          owner?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          url?: string
          views_30d?: number | null
        }
        Relationships: []
      }
      features: {
        Row: {
          assignees: string[] | null
          created_at: string
          design_specs: string | null
          documentation: string | null
          due_date: string | null
          feature_level: string
          feature_type: string
          id: string
          product_category_id: string | null
          qa_plan: string | null
          release_version_id: string | null
          rollout_instructions: string | null
          sort_order: number | null
          start_date: string | null
          status: string
          subtask_count: number | null
          summary: string | null
          technical_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignees?: string[] | null
          created_at?: string
          design_specs?: string | null
          documentation?: string | null
          due_date?: string | null
          feature_level: string
          feature_type: string
          id?: string
          product_category_id?: string | null
          qa_plan?: string | null
          release_version_id?: string | null
          rollout_instructions?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: string
          subtask_count?: number | null
          summary?: string | null
          technical_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignees?: string[] | null
          created_at?: string
          design_specs?: string | null
          documentation?: string | null
          due_date?: string | null
          feature_level?: string
          feature_type?: string
          id?: string
          product_category_id?: string | null
          qa_plan?: string | null
          release_version_id?: string | null
          rollout_instructions?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: string
          subtask_count?: number | null
          summary?: string | null
          technical_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "features_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_release_version_id_fkey"
            columns: ["release_version_id"]
            isOneToOne: false
            referencedRelation: "release_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          capabilities: string[] | null
          category: string
          created_at: string
          directionality: string
          docs_link: string | null
          health: string
          id: string
          known_limitations: string | null
          last_updated: string
          name: string
          owner: string | null
          status: string
          vendor: string
          version: string | null
        }
        Insert: {
          capabilities?: string[] | null
          category: string
          created_at?: string
          directionality?: string
          docs_link?: string | null
          health?: string
          id?: string
          known_limitations?: string | null
          last_updated?: string
          name: string
          owner?: string | null
          status: string
          vendor: string
          version?: string | null
        }
        Update: {
          capabilities?: string[] | null
          category?: string
          created_at?: string
          directionality?: string
          docs_link?: string | null
          health?: string
          id?: string
          known_limitations?: string | null
          last_updated?: string
          name?: string
          owner?: string | null
          status?: string
          vendor?: string
          version?: string | null
        }
        Relationships: []
      }
      job_api_logs: {
        Row: {
          company_name: string
          created_at: string
          execution_time_seconds: number
          id: number
          jobs_created: number
          jobs_deleted: number
          jobs_updated: number
          push_additional_info: Json
          push_error_details: Json
          push_id: number
          push_status: string
          push_timestamp: string
          record_type: string
          total_errors: number
          total_jobs_processed: number
        }
        Insert: {
          company_name: string
          created_at?: string
          execution_time_seconds?: number
          id: number
          jobs_created?: number
          jobs_deleted?: number
          jobs_updated?: number
          push_additional_info?: Json
          push_error_details?: Json
          push_id: number
          push_status: string
          push_timestamp: string
          record_type: string
          total_errors?: number
          total_jobs_processed?: number
        }
        Update: {
          company_name?: string
          created_at?: string
          execution_time_seconds?: number
          id?: number
          jobs_created?: number
          jobs_deleted?: number
          jobs_updated?: number
          push_additional_info?: Json
          push_error_details?: Json
          push_id?: number
          push_status?: string
          push_timestamp?: string
          record_type?: string
          total_errors?: number
          total_jobs_processed?: number
        }
        Relationships: []
      }
      loom_videos: {
        Row: {
          created_at: string
          description: string
          duration: string | null
          folder: string | null
          id: string
          is_pinned: boolean | null
          last_updated: string
          loom_url: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          view_count: number | null
        }
        Insert: {
          created_at?: string
          description: string
          duration?: string | null
          folder?: string | null
          id?: string
          is_pinned?: boolean | null
          last_updated?: string
          loom_url: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          view_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          duration?: string | null
          folder?: string | null
          id?: string
          is_pinned?: boolean | null
          last_updated?: string
          loom_url?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          view_count?: number | null
        }
        Relationships: []
      }
      mock_users: {
        Row: {
          avatar_color: string | null
          avatar_url: string | null
          capacity_hours_per_week: number | null
          created_at: string
          email: string | null
          id: string
          name: string
          role: string
          secondary_role: string | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          capacity_hours_per_week?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          role: string
          secondary_role?: string | null
        }
        Update: {
          avatar_color?: string | null
          avatar_url?: string | null
          capacity_hours_per_week?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: string
          secondary_role?: string | null
        }
        Relationships: []
      }
      pm_active_timers: {
        Row: {
          note: string | null
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          note?: string | null
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          note?: string | null
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_active_timers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json | null
          project_id: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          project_id?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          project_id?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_attachments: {
        Row: {
          file_size: number | null
          id: string
          label: string | null
          name: string
          project_id: string | null
          task_id: string | null
          type: string
          uploaded_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          file_size?: number | null
          id?: string
          label?: string | null
          name: string
          project_id?: string | null
          task_id?: string | null
          type?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          file_size?: number | null
          id?: string
          label?: string | null
          name?: string
          project_id?: string | null
          task_id?: string | null
          type?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_checklist_items: {
        Row: {
          checked: boolean
          id: string
          label: string
          sort_order: number
          task_id: string
        }
        Insert: {
          checked?: boolean
          id?: string
          label: string
          sort_order?: number
          task_id: string
        }
        Update: {
          checked?: boolean
          id?: string
          label?: string
          sort_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_client_environments: {
        Row: {
          client_id: string
          contacts: Json | null
          id: string
          integrations: Json | null
          name: string
          notes: string | null
          prod_endpoint: string | null
          staging_endpoint: string | null
        }
        Insert: {
          client_id: string
          contacts?: Json | null
          id?: string
          integrations?: Json | null
          name: string
          notes?: string | null
          prod_endpoint?: string | null
          staging_endpoint?: string | null
        }
        Update: {
          client_id?: string
          contacts?: Json | null
          id?: string
          integrations?: Json | null
          name?: string
          notes?: string | null
          prod_endpoint?: string | null
          staging_endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_client_environments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: string[] | null
          pinned: boolean
          project_id: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          pinned?: boolean
          project_id?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          pinned?: boolean
          project_id?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_design_rounds: {
        Row: {
          created_at: string
          feedback_notes: string | null
          id: string
          round_number: number
          status: string
          submitted_date: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          feedback_notes?: string | null
          id?: string
          round_number?: number
          status?: string
          submitted_date?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          feedback_notes?: string | null
          id?: string
          round_number?: number
          status?: string
          submitted_date?: string | null
          task_id?: string
        }
        Relationships: []
      }
      pm_dev_status_log: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          note: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          note: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string
          task_id?: string
        }
        Relationships: []
      }
      pm_form_fields: {
        Row: {
          conditionals: Json | null
          form_id: string
          id: string
          label: string
          options: Json | null
          placeholder: string | null
          required: boolean
          sort_order: number
          type: string
        }
        Insert: {
          conditionals?: Json | null
          form_id: string
          id?: string
          label: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          type: string
        }
        Update: {
          conditionals?: Json | null
          form_id?: string
          id?: string
          label?: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "pm_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_form_submissions: {
        Row: {
          created_at: string
          created_project_id: string | null
          created_task_id: string | null
          form_id: string
          id: string
          payload: Json
          status: string
          submitter_email: string | null
          submitter_name: string | null
        }
        Insert: {
          created_at?: string
          created_project_id?: string | null
          created_task_id?: string | null
          form_id: string
          id?: string
          payload: Json
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
        }
        Update: {
          created_at?: string
          created_project_id?: string | null
          created_task_id?: string | null
          form_id?: string
          id?: string
          payload?: Json
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_form_submissions_created_project_id_fkey"
            columns: ["created_project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_form_submissions_created_task_id_fkey"
            columns: ["created_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "pm_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_forms: {
        Row: {
          auth_token: string | null
          client_id: string | null
          created_at: string
          id: string
          kind: string
          name: string
          notify_emails: string[] | null
          request_type: string | null
          shareable_slug: string | null
          submit_action: Json | null
          webhook_url: string | null
        }
        Insert: {
          auth_token?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
          notify_emails?: string[] | null
          request_type?: string | null
          shareable_slug?: string | null
          submit_action?: Json | null
          webhook_url?: string | null
        }
        Update: {
          auth_token?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notify_emails?: string[] | null
          request_type?: string | null
          shareable_slug?: string | null
          submit_action?: Json | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_forms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_project_attachments: {
        Row: {
          created_at: string
          file_size: number | null
          id: string
          label: string | null
          name: string
          project_id: string
          type: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          id?: string
          label?: string | null
          name: string
          project_id: string
          type?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          file_size?: number | null
          id?: string
          label?: string | null
          name?: string
          project_id?: string
          type?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      pm_project_members: {
        Row: {
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_project_phases: {
        Row: {
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pm_project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_project_templates: {
        Row: {
          created_at: string
          default_go_live_offset_days: number | null
          description: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          default_go_live_offset_days?: number | null
          description?: string | null
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          default_go_live_offset_days?: number | null
          description?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      pm_projects: {
        Row: {
          client_contact_email: string | null
          client_contact_name: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          go_live_date: string | null
          id: string
          kickoff_date: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          template_id: string | null
          title: string
          type: string
          updated_at: string
          work_type: string
        }
        Insert: {
          client_contact_email?: string | null
          client_contact_name?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          go_live_date?: string | null
          id?: string
          kickoff_date?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          template_id?: string | null
          title: string
          type?: string
          updated_at?: string
          work_type?: string
        }
        Update: {
          client_contact_email?: string | null
          client_contact_name?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          go_live_date?: string | null
          id?: string
          kickoff_date?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          template_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pm_project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_snippet_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pm_snippet_variations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          snippet_id: string
          sort_order: number
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          snippet_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          snippet_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pm_snippet_variations_snippet_id_fkey"
            columns: ["snippet_id"]
            isOneToOne: false
            referencedRelation: "pm_snippets"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_snippets: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          language: string | null
          project_ids: string[] | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          language?: string | null
          project_ids?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          language?: string | null
          project_ids?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_snippets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pm_snippet_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_subtasks: {
        Row: {
          complete: boolean
          id: string
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          complete?: boolean
          id?: string
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          complete?: boolean
          id?: string
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_dependencies: {
        Row: {
          depends_on_task_id: string
          id: string
          lag_days: number | null
          task_id: string
          type: string
        }
        Insert: {
          depends_on_task_id: string
          id?: string
          lag_days?: number | null
          task_id: string
          type?: string
        }
        Update: {
          depends_on_task_id?: string
          id?: string
          lag_days?: number | null
          task_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          task_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          task_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          task_id?: string
          url?: string
        }
        Relationships: []
      }
      pm_task_snippets: {
        Row: {
          id: string
          linked_at: string
          linked_by: string | null
          snippet_id: string
          task_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          linked_by?: string | null
          snippet_id: string
          task_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          linked_by?: string | null
          snippet_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_snippets_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_snippets_snippet_id_fkey"
            columns: ["snippet_id"]
            isOneToOne: false
            referencedRelation: "pm_snippets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_snippets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          description: string | null
          design_approval: string | null
          design_round: number | null
          dev_blocker: string | null
          dev_environment: string | null
          dev_links: Json | null
          dev_status_log: Json | null
          due_date: string | null
          duration_days: number
          id: string
          locked: boolean
          locked_to_go_live: boolean
          locked_to_kickoff: boolean
          min_duration_days: number | null
          page_group_key: string | null
          page_label: string | null
          parent_task_id: string | null
          phase_id: string | null
          priority: string
          project_id: string
          sort_order: number
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          track: string
          type: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          design_approval?: string | null
          design_round?: number | null
          dev_blocker?: string | null
          dev_environment?: string | null
          dev_links?: Json | null
          dev_status_log?: Json | null
          due_date?: string | null
          duration_days?: number
          id?: string
          locked?: boolean
          locked_to_go_live?: boolean
          locked_to_kickoff?: boolean
          min_duration_days?: number | null
          page_group_key?: string | null
          page_label?: string | null
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: string
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          track?: string
          type?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          description?: string | null
          design_approval?: string | null
          design_round?: number | null
          dev_blocker?: string | null
          dev_environment?: string | null
          dev_links?: Json | null
          dev_status_log?: Json | null
          due_date?: string | null
          duration_days?: number
          id?: string
          locked?: boolean
          locked_to_go_live?: boolean
          locked_to_kickoff?: boolean
          min_duration_days?: number | null
          page_group_key?: string | null
          page_label?: string | null
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: string
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          track?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "pm_project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_template_dependencies: {
        Row: {
          from_temp_id: string
          id: string
          lag_days: number | null
          template_id: string
          to_temp_id: string
          type: string
        }
        Insert: {
          from_temp_id: string
          id?: string
          lag_days?: number | null
          template_id: string
          to_temp_id: string
          type?: string
        }
        Update: {
          from_temp_id?: string
          id?: string
          lag_days?: number | null
          template_id?: string
          to_temp_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_template_dependencies_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pm_project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_template_page_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          parallel: boolean
          phase_name: string | null
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parallel?: boolean
          phase_name?: string | null
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parallel?: boolean
          phase_name?: string | null
          sort_order?: number
          template_id?: string
        }
        Relationships: []
      }
      pm_template_page_presets: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          page_group_id: string | null
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          page_group_id?: string | null
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          page_group_id?: string | null
          sort_order?: number
          template_id?: string
        }
        Relationships: []
      }
      pm_template_task_snippets: {
        Row: {
          id: string
          snippet_id: string
          template_task_id: string
        }
        Insert: {
          id?: string
          snippet_id: string
          template_task_id: string
        }
        Update: {
          id?: string
          snippet_id?: string
          template_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_template_task_snippets_snippet_id_fkey"
            columns: ["snippet_id"]
            isOneToOne: false
            referencedRelation: "pm_snippets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_template_task_snippets_template_task_id_fkey"
            columns: ["template_task_id"]
            isOneToOne: false
            referencedRelation: "pm_template_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_template_tasks: {
        Row: {
          assignee_role: string | null
          checklist_items: Json | null
          duration_days: number
          id: string
          locked: boolean
          locked_to_go_live: boolean
          locked_to_kickoff: boolean
          min_duration_days: number | null
          page_group_id: string | null
          parallel_with_temp_id: string | null
          phase_name: string | null
          role: string | null
          sort_order: number
          temp_id: string
          template_id: string
          title: string
          track: string | null
          type: string
        }
        Insert: {
          assignee_role?: string | null
          checklist_items?: Json | null
          duration_days?: number
          id?: string
          locked?: boolean
          locked_to_go_live?: boolean
          locked_to_kickoff?: boolean
          min_duration_days?: number | null
          page_group_id?: string | null
          parallel_with_temp_id?: string | null
          phase_name?: string | null
          role?: string | null
          sort_order?: number
          temp_id: string
          template_id: string
          title: string
          track?: string | null
          type: string
        }
        Update: {
          assignee_role?: string | null
          checklist_items?: Json | null
          duration_days?: number
          id?: string
          locked?: boolean
          locked_to_go_live?: boolean
          locked_to_kickoff?: boolean
          min_duration_days?: number | null
          page_group_id?: string | null
          parallel_with_temp_id?: string | null
          phase_name?: string | null
          role?: string | null
          sort_order?: number
          temp_id?: string
          template_id?: string
          title?: string
          track?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pm_project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_time_entries: {
        Row: {
          id: string
          logged_at: string
          minutes: number
          note: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          minutes: number
          note?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          id?: string
          logged_at?: string
          minutes?: number
          note?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mock_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_webhook_deliveries: {
        Row: {
          attempted_at: string
          event: string
          id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          attempted_at?: string
          event: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          attempted_at?: string
          event?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "pm_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          headers: Json | null
          id: string
          name: string
          secret: string | null
          target_url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          headers?: Json | null
          id?: string
          name: string
          secret?: string | null
          target_url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          headers?: Json | null
          id?: string
          name?: string
          secret?: string | null
          target_url?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      release_versions: {
        Row: {
          created_at: string
          id: string
          is_backlog: boolean | null
          name: string
          quarter: number | null
          sort_order: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_backlog?: boolean | null
          name: string
          quarter?: number | null
          sort_order: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_backlog?: boolean | null
          name?: string
          quarter?: number | null
          sort_order?: number
          year?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          name: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_job_api_stats: {
        Args: never
        Returns: {
          avg_execution_time: number
          failed_pushes: number
          successful_pushes: number
          total_errors: number
          total_jobs_processed: number
          total_pushes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

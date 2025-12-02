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
    PostgrestVersion: "13.0.5"
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

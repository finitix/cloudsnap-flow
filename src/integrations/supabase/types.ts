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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      aws_connections: {
        Row: {
          access_key_id: string
          connection_type: string
          created_at: string
          default_region: string
          display_name: string
          free_tier_alerts: boolean
          id: string
          is_active: boolean
          role_arn: string | null
          secret_access_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_key_id: string
          connection_type?: string
          created_at?: string
          default_region?: string
          display_name?: string
          free_tier_alerts?: boolean
          id?: string
          is_active?: boolean
          role_arn?: string | null
          secret_access_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_key_id?: string
          connection_type?: string
          created_at?: string
          default_region?: string
          display_name?: string
          free_tier_alerts?: boolean
          id?: string
          is_active?: boolean
          role_arn?: string | null
          secret_access_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aws_infrastructure: {
        Row: {
          aws_connection_id: string
          created_at: string
          db_subnet_group_name: string | null
          error_message: string | null
          estimated_monthly_cost: number | null
          id: string
          internet_gateway_id: string | null
          private_subnet_id: string | null
          project_id: string
          public_subnet_id: string | null
          region: string
          security_group_id: string | null
          status: string
          updated_at: string
          user_id: string
          vpc_id: string | null
        }
        Insert: {
          aws_connection_id: string
          created_at?: string
          db_subnet_group_name?: string | null
          error_message?: string | null
          estimated_monthly_cost?: number | null
          id?: string
          internet_gateway_id?: string | null
          private_subnet_id?: string | null
          project_id: string
          public_subnet_id?: string | null
          region?: string
          security_group_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vpc_id?: string | null
        }
        Update: {
          aws_connection_id?: string
          created_at?: string
          db_subnet_group_name?: string | null
          error_message?: string | null
          estimated_monthly_cost?: number | null
          id?: string
          internet_gateway_id?: string | null
          private_subnet_id?: string | null
          project_id?: string
          public_subnet_id?: string | null
          region?: string
          security_group_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vpc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aws_infrastructure_aws_connection_id_fkey"
            columns: ["aws_connection_id"]
            isOneToOne: false
            referencedRelation: "aws_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aws_infrastructure_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      aws_resources: {
        Row: {
          auto_stop_enabled: boolean | null
          config: Json | null
          created_at: string
          id: string
          infrastructure_id: string
          last_active_at: string | null
          monthly_cost_estimate: number | null
          public_ip: string | null
          public_url: string | null
          resource_arn: string | null
          resource_id: string | null
          resource_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_stop_enabled?: boolean | null
          config?: Json | null
          created_at?: string
          id?: string
          infrastructure_id: string
          last_active_at?: string | null
          monthly_cost_estimate?: number | null
          public_ip?: string | null
          public_url?: string | null
          resource_arn?: string | null
          resource_id?: string | null
          resource_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_stop_enabled?: boolean | null
          config?: Json | null
          created_at?: string
          id?: string
          infrastructure_id?: string
          last_active_at?: string | null
          monthly_cost_estimate?: number | null
          public_ip?: string | null
          public_url?: string | null
          resource_arn?: string | null
          resource_id?: string | null
          resource_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aws_resources_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "aws_infrastructure"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_connections: {
        Row: {
          connected_at: string
          display_name: string | null
          id: string
          provider: string
          team_id: string | null
          token: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          display_name?: string | null
          id?: string
          provider: string
          team_id?: string | null
          token: string
          user_id: string
        }
        Update: {
          connected_at?: string
          display_name?: string | null
          id?: string
          provider?: string
          team_id?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      deployment_alerts: {
        Row: {
          alert_type: string
          created_at: string
          deployment_id: string
          id: string
          is_read: boolean
          message: string
          project_id: string
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          deployment_id: string
          id?: string
          is_read?: boolean
          message: string
          project_id: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          deployment_id?: string
          id?: string
          is_read?: boolean
          message?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployment_alerts_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_heal_logs: {
        Row: {
          attempt_number: number
          created_at: string
          deployment_id: string
          error_category: string
          error_message: string | null
          fix_applied: string | null
          fix_details: Json | null
          id: string
          result: string
          user_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          deployment_id: string
          error_category?: string
          error_message?: string | null
          fix_applied?: string | null
          fix_details?: Json | null
          id?: string
          result?: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          deployment_id?: string
          error_category?: string
          error_message?: string | null
          fix_applied?: string | null
          fix_details?: Json | null
          id?: string
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployment_heal_logs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          cloud_connection_id: string | null
          cpu_usage: number | null
          created_at: string
          deploy_id: string | null
          error_message: string | null
          id: string
          last_error_category: string | null
          live_url: string | null
          logs: string | null
          max_retries: number
          memory_usage: number | null
          project_id: string
          provider: string
          retry_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cloud_connection_id?: string | null
          cpu_usage?: number | null
          created_at?: string
          deploy_id?: string | null
          error_message?: string | null
          id?: string
          last_error_category?: string | null
          live_url?: string | null
          logs?: string | null
          max_retries?: number
          memory_usage?: number | null
          project_id: string
          provider: string
          retry_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cloud_connection_id?: string | null
          cpu_usage?: number | null
          created_at?: string
          deploy_id?: string | null
          error_message?: string | null
          id?: string
          last_error_category?: string | null
          live_url?: string | null
          logs?: string | null
          max_retries?: number
          memory_usage?: number | null
          project_id?: string
          provider?: string
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_cloud_connection_id_fkey"
            columns: ["cloud_connection_id"]
            isOneToOne: false
            referencedRelation: "cloud_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email: string
          id: string
          is_published: boolean
          message: string
          name: string
          rating: number | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_published?: boolean
          message: string
          name: string
          rating?: number | null
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_published?: boolean
          message?: string
          name?: string
          rating?: number | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          aws_connection_id: string | null
          aws_region: string | null
          backend_build_command: string | null
          backend_framework: string | null
          backend_start_command: string | null
          build_command: string | null
          created_at: string
          database_engine: string | null
          framework: string | null
          frontend_build_command: string | null
          frontend_framework: string | null
          frontend_output_dir: string | null
          github_url: string | null
          id: string
          name: string
          output_dir: string | null
          project_type: string | null
          source_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aws_connection_id?: string | null
          aws_region?: string | null
          backend_build_command?: string | null
          backend_framework?: string | null
          backend_start_command?: string | null
          build_command?: string | null
          created_at?: string
          database_engine?: string | null
          framework?: string | null
          frontend_build_command?: string | null
          frontend_framework?: string | null
          frontend_output_dir?: string | null
          github_url?: string | null
          id?: string
          name: string
          output_dir?: string | null
          project_type?: string | null
          source_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aws_connection_id?: string | null
          aws_region?: string | null
          backend_build_command?: string | null
          backend_framework?: string | null
          backend_start_command?: string | null
          build_command?: string | null
          created_at?: string
          database_engine?: string | null
          framework?: string | null
          frontend_build_command?: string | null
          frontend_framework?: string | null
          frontend_output_dir?: string | null
          github_url?: string | null
          id?: string
          name?: string
          output_dir?: string | null
          project_type?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_aws_connection_id_fkey"
            columns: ["aws_connection_id"]
            isOneToOne: false
            referencedRelation: "aws_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      cleanup_stuck_deployments: { Args: never; Returns: undefined }
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

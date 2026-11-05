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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          category: string
          created_at: string
          file_path: string
          id: string
          mime_type: string
          name: string
          size_bytes: number
          updated_at: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          file_path: string
          id?: string
          mime_type: string
          name: string
          size_bytes: number
          updated_at?: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_path?: string
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          updated_at?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_documents: {
        Row: {
          created_at: string
          file_path: string
          id: string
          mime_type: string
          name: string
          size_bytes: number
          status: string
          updated_at: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          mime_type: string
          name: string
          size_bytes: number
          status?: string
          updated_at?: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          status?: string
          updated_at?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_fonts: {
        Row: {
          created_at: string
          guidelines: string
          id: string
          is_demo: boolean
          name: string
          updated_at: string
          usage: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          guidelines?: string
          id?: string
          is_demo?: boolean
          name: string
          updated_at?: string
          usage?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          guidelines?: string
          id?: string
          is_demo?: boolean
          name?: string
          updated_at?: string
          usage?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_fonts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          brand_name: string
          created_at: string
          description: string
          industry: string
          is_demo: boolean
          mission: string
          positioning: string
          target_audience: string
          updated_at: string
          updated_by: string | null
          website: string
          workspace_id: string
        }
        Insert: {
          brand_name?: string
          created_at?: string
          description?: string
          industry?: string
          is_demo?: boolean
          mission?: string
          positioning?: string
          target_audience?: string
          updated_at?: string
          updated_by?: string | null
          website?: string
          workspace_id: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          description?: string
          industry?: string
          is_demo?: boolean
          mission?: string
          positioning?: string
          target_audience?: string
          updated_at?: string
          updated_by?: string | null
          website?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_history: {
        Row: {
          change: string
          changed_at: string
          changed_by: string | null
          fact_id: string
          id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Insert: {
          change: string
          changed_at?: string
          changed_by?: string | null
          fact_id: string
          id?: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Update: {
          change?: string
          changed_at?: string
          changed_by?: string | null
          fact_id?: string
          id?: string
          snapshot?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facts: {
        Row: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          code: string
          created_at: string
          created_by: string | null
          evidence: string
          id: string
          is_demo: boolean
          source_note: string
          statement: string
          status: Database["public"]["Enums"]["fact_status"]
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          evidence?: string
          id?: string
          is_demo?: boolean
          source_note?: string
          statement: string
          status?: Database["public"]["Enums"]["fact_status"]
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          evidence?: string
          id?: string
          is_demo?: boolean
          source_note?: string
          statement?: string
          status?: Database["public"]["Enums"]["fact_status"]
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary: {
        Row: {
          avoided_terms: string[]
          case_sensitive: boolean
          created_at: string
          id: string
          is_demo: boolean
          note: string
          preferred_term: string
          spelling_note: string
          updated_at: string
          usage_example: string
          workspace_id: string
        }
        Insert: {
          avoided_terms?: string[]
          case_sensitive?: boolean
          created_at?: string
          id?: string
          is_demo?: boolean
          note?: string
          preferred_term: string
          spelling_note?: string
          updated_at?: string
          usage_example?: string
          workspace_id: string
        }
        Update: {
          avoided_terms?: string[]
          case_sensitive?: boolean
          created_at?: string
          id?: string
          is_demo?: boolean
          note?: string
          preferred_term?: string
          spelling_note?: string
          updated_at?: string
          usage_example?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glossary_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      palette: {
        Row: {
          created_at: string
          hex: string
          id: string
          is_demo: boolean
          name: string
          updated_at: string
          usage_note: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          hex: string
          id?: string
          is_demo?: boolean
          name: string
          updated_at?: string
          usage_note?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          hex?: string
          id?: string
          is_demo?: boolean
          name?: string
          updated_at?: string
          usage_note?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "palette_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      rule_history: {
        Row: {
          change: string
          changed_at: string
          changed_by: string | null
          id: string
          rule_id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Insert: {
          change: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          rule_id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Update: {
          change?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          rule_id?: string
          snapshot?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["rule_category"]
          code: string
          created_at: string
          created_by: string | null
          description: string
          examples: string
          explanation: string
          id: string
          is_demo: boolean
          kind: Database["public"]["Enums"]["rule_kind"]
          pattern: Json
          rule_type: Database["public"]["Enums"]["rule_type"]
          severity: Database["public"]["Enums"]["rule_severity"]
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["rule_category"]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          examples?: string
          explanation?: string
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["rule_kind"]
          pattern?: Json
          rule_type?: Database["public"]["Enums"]["rule_type"]
          severity?: Database["public"]["Enums"]["rule_severity"]
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["rule_category"]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          examples?: string
          explanation?: string
          id?: string
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["rule_kind"]
          pattern?: Json
          rule_type?: Database["public"]["Enums"]["rule_type"]
          severity?: Database["public"]["Enums"]["rule_severity"]
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_workspace_id_user_id_fkey"
            columns: ["workspace_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_workspace_member_by_email: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
          _workspace_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      kb_storage_workspace: { Args: { _name: string }; Returns: string }
      load_demo_knowledge: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      manage_workspace_member: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      remove_demo_knowledge: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      rename_workspace: {
        Args: { _name: string; _workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "creator" | "manager" | "reviewer" | "admin"
      fact_status: "pending" | "approved" | "rejected" | "expired"
      rule_category:
        | "legal"
        | "claim"
        | "terminology"
        | "tone"
        | "visual"
        | "accessibility"
      rule_kind: "banned_term" | "required_phrase" | "tone_guidance" | "visual"
      rule_severity: "critical" | "high" | "medium" | "low"
      rule_type: "mandatory" | "prohibited" | "recommended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["creator", "manager", "reviewer", "admin"],
      fact_status: ["pending", "approved", "rejected", "expired"],
      rule_category: [
        "legal",
        "claim",
        "terminology",
        "tone",
        "visual",
        "accessibility",
      ],
      rule_kind: ["banned_term", "required_phrase", "tone_guidance", "visual"],
      rule_severity: ["critical", "high", "medium", "low"],
      rule_type: ["mandatory", "prohibited", "recommended"],
    },
  },
} as const

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
      ai_calls: {
        Row: {
          content_id: string
          content_version_id: string
          created_at: string
          error_kind: string | null
          id: string
          model: string
          prompt_version: string
          provider: string
          requested_by: string
          review_id: string | null
          status: string
          what_was_sent_summary: string
          workspace_id: string
        }
        Insert: {
          content_id: string
          content_version_id: string
          created_at?: string
          error_kind?: string | null
          id?: string
          model: string
          prompt_version: string
          provider: string
          requested_by: string
          review_id?: string | null
          status: string
          what_was_sent_summary: string
          workspace_id: string
        }
        Update: {
          content_id?: string
          content_version_id?: string
          created_at?: string
          error_kind?: string | null
          id?: string
          model?: string
          prompt_version?: string
          provider?: string
          requested_by?: string
          review_id?: string | null
          status?: string
          what_was_sent_summary?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          ai_state_at_routing: string
          assigned_by: string
          check_limitations: Json
          check_outcome: string | null
          content_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          id: string
          reviewer_id: string | null
          route: string
          route_reasons: Json
          status: string
          version_id: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          ai_state_at_routing: string
          assigned_by: string
          check_limitations?: Json
          check_outcome?: string | null
          content_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          id?: string
          reviewer_id?: string | null
          route: string
          route_reasons?: Json
          status?: string
          version_id: string
          version_number: number
          workspace_id: string
        }
        Update: {
          ai_state_at_routing?: string
          assigned_by?: string
          check_limitations?: Json
          check_outcome?: string | null
          content_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          id?: string
          reviewer_id?: string | null
          route?: string
          route_reasons?: Json
          status?: string
          version_id?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      comments: {
        Row: {
          author_id: string
          content_id: string
          created_at: string
          id: string
          message: string
          parent_id: string | null
          workspace_id: string
        }
        Insert: {
          author_id: string
          content_id: string
          created_at?: string
          id?: string
          message: string
          parent_id?: string | null
          workspace_id: string
        }
        Update: {
          author_id?: string
          content_id?: string
          created_at?: string
          id?: string
          message?: string
          parent_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          alt_text: string | null
          audience: string
          background_color: string | null
          body_text: string
          change_summary: string
          changed_by: string
          channel: string
          content_id: string
          created_at: string
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          goal: string
          id: string
          text_color: string | null
          title: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          alt_text?: string | null
          audience: string
          background_color?: string | null
          body_text: string
          change_summary?: string
          changed_by: string
          channel: string
          content_id: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          goal: string
          id?: string
          text_color?: string | null
          title: string
          version_number: number
          workspace_id: string
        }
        Update: {
          alt_text?: string | null
          audience?: string
          background_color?: string | null
          body_text?: string
          change_summary?: string
          changed_by?: string
          channel?: string
          content_id?: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          goal?: string
          id?: string
          text_color?: string | null
          title?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          alt_text: string | null
          audience: string
          background_color: string | null
          body_text: string
          channel: string
          created_at: string
          deleted_at: string | null
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          goal: string
          id: string
          owner_id: string
          status: Database["public"]["Enums"]["content_status"]
          submitted_at: string | null
          text_color: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          alt_text?: string | null
          audience?: string
          background_color?: string | null
          body_text?: string
          channel?: string
          created_at?: string
          deleted_at?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          goal?: string
          id?: string
          owner_id: string
          status?: Database["public"]["Enums"]["content_status"]
          submitted_at?: string | null
          text_color?: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          alt_text?: string | null
          audience?: string
          background_color?: string | null
          body_text?: string
          channel?: string
          created_at?: string
          deleted_at?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          goal?: string
          id?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          submitted_at?: string | null
          text_color?: string | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
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
      finding_actions: {
        Row: {
          action: string
          actor_id: string
          content_id: string
          created_at: string
          final_text: string | null
          finding_id: string
          id: string
          reason: string | null
          result_version_id: string | null
          version_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id: string
          content_id: string
          created_at?: string
          final_text?: string | null
          finding_id: string
          id?: string
          reason?: string | null
          result_version_id?: string | null
          version_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          content_id?: string
          created_at?: string
          final_text?: string | null
          finding_id?: string
          id?: string
          reason?: string | null
          result_version_id?: string | null
          version_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finding_actions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_actions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: true
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_actions_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_actions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          bbox: Json | null
          category: string
          check_name: string
          cited_code: string
          cited_id: string | null
          cited_kind: string
          cited_passage: string
          confidence: number
          content_id: string
          created_at: string
          decided_by: string | null
          dismissal_reason: string | null
          evidence_kind: string
          explanation: string
          final_text: string | null
          id: string
          outcome: string
          quoted_text: string
          review_id: string
          severity: string
          source: string
          span_end: number | null
          span_start: number | null
          suggested_text: string | null
          workspace_id: string
        }
        Insert: {
          bbox?: Json | null
          category: string
          check_name: string
          cited_code?: string
          cited_id?: string | null
          cited_kind: string
          cited_passage?: string
          confidence: number
          content_id: string
          created_at?: string
          decided_by?: string | null
          dismissal_reason?: string | null
          evidence_kind?: string
          explanation: string
          final_text?: string | null
          id?: string
          outcome: string
          quoted_text?: string
          review_id: string
          severity: string
          source?: string
          span_end?: number | null
          span_start?: number | null
          suggested_text?: string | null
          workspace_id: string
        }
        Update: {
          bbox?: Json | null
          category?: string
          check_name?: string
          cited_code?: string
          cited_id?: string | null
          cited_kind?: string
          cited_passage?: string
          confidence?: number
          content_id?: string
          created_at?: string
          decided_by?: string | null
          dismissal_reason?: string | null
          evidence_kind?: string
          explanation?: string
          final_text?: string | null
          id?: string
          outcome?: string
          quoted_text?: string
          review_id?: string
          severity?: string
          source?: string
          span_end?: number | null
          span_start?: number | null
          suggested_text?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_workspace_id_fkey"
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
      reviews: {
        Row: {
          content_id: string
          content_version_id: string
          created_at: string
          downgraded_findings_count: number
          dropped_findings_count: number
          evidence_text: string | null
          file_sha256: string | null
          finding_count: number
          id: string
          limitations: Json
          model: string | null
          prompt_version: string | null
          run_at: string
          run_by: string
          source: string
          status: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          content_id: string
          content_version_id: string
          created_at?: string
          downgraded_findings_count?: number
          dropped_findings_count?: number
          evidence_text?: string | null
          file_sha256?: string | null
          finding_count?: number
          id?: string
          limitations?: Json
          model?: string | null
          prompt_version?: string | null
          run_at?: string
          run_by: string
          source?: string
          status: string
          version_number: number
          workspace_id: string
        }
        Update: {
          content_id?: string
          content_version_id?: string
          created_at?: string
          downgraded_findings_count?: number
          dropped_findings_count?: number
          evidence_text?: string | null
          file_sha256?: string | null
          finding_count?: number
          id?: string
          limitations?: Json
          model?: string | null
          prompt_version?: string | null
          run_at?: string
          run_by?: string
          source?: string
          status?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      act_on_finding: {
        Args: {
          _action: string
          _actor: string
          _content_id: string
          _expected_version: number
          _final_text: string
          _finding_id: string
          _new_body: string
          _reason: string
        }
        Returns: number
      }
      add_comment: {
        Args: { _content_id: string; _message: string; _parent_id: string }
        Returns: string
      }
      add_workspace_member_by_email: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
          _workspace_id: string
        }
        Returns: undefined
      }
      ai_state: { Args: { _version_id: string }; Returns: string }
      approval_route_facts: { Args: { _content_id: string }; Returns: Json }
      can_inspect_content_review: {
        Args: { _content_id: string }
        Returns: boolean
      }
      can_read_content: { Args: { _content_id: string }; Returns: boolean }
      can_read_content_file: { Args: { _name: string }; Returns: boolean }
      can_upload_content_file: { Args: { _name: string }; Returns: boolean }
      content_audit: {
        Args: {
          _action: string
          _actor: string
          _id: string
          _meta: Json
          _ws: string
        }
        Returns: undefined
      }
      content_file_content_id: { Args: { _name: string }; Returns: string }
      content_snapshot: {
        Args: {
          _actor: string
          _c: Database["public"]["Tables"]["contents"]["Row"]
          _summary: string
        }
        Returns: undefined
      }
      content_validate: {
        Args: {
          _alt: string
          _audience: string
          _bg: string
          _body: string
          _channel: string
          _goal: string
          _tc: string
          _title: string
        }
        Returns: undefined
      }
      create_content: {
        Args: {
          _alt_text: string
          _audience: string
          _background_color: string
          _body_text: string
          _channel: string
          _goal: string
          _text_color: string
          _title: string
          _type: Database["public"]["Enums"]["content_type"]
          _workspace_id: string
        }
        Returns: string
      }
      decide_approval: {
        Args: {
          _approval_id: string
          _comment: string
          _decision: string
          _expected_version: number
        }
        Returns: undefined
      }
      delete_content_draft: {
        Args: { _content_id: string }
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
      is_assigned_reviewer: { Args: { _content_id: string }; Returns: boolean }
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
      purge_workspace_content: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      record_ai_review: {
        Args: {
          _actor: string
          _content_id: string
          _content_version_id: string
          _downgraded: number
          _dropped: number
          _evidence_text: string
          _file_sha256: string
          _findings: Json
          _limitations: Json
          _model: string
          _prompt_version: string
          _sent_summary: string
        }
        Returns: string
      }
      record_review: {
        Args: {
          _actor: string
          _content_id: string
          _content_version_id: string
          _dropped: number
          _findings: Json
          _limitations: Json
        }
        Returns: string
      }
      remove_demo_knowledge: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      rename_workspace: {
        Args: { _name: string; _workspace_id: string }
        Returns: undefined
      }
      save_content_draft: {
        Args: {
          _alt_text: string
          _audience: string
          _background_color: string
          _body_text: string
          _channel: string
          _content_id: string
          _expected_version: number
          _goal: string
          _pdf_text_confirmed: boolean
          _text_color: string
          _title: string
        }
        Returns: number
      }
      set_content_file: {
        Args: {
          _actor: string
          _content_id: string
          _expected_version: number
          _file_mime: string
          _file_name: string
          _file_path: string
          _file_size: number
        }
        Returns: number
      }
      submit_content: {
        Args: { _content_id: string; _expected_version: number }
        Returns: undefined
      }
      submit_for_approval: {
        Args: {
          _content_id: string
          _expected_version: number
          _reviewer_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "creator" | "manager" | "reviewer" | "admin"
      content_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "changes_requested"
        | "checked"
        | "pending_manager"
        | "pending_reviewer"
      content_type: "text" | "image" | "pdf"
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
      content_status: [
        "draft",
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "changes_requested",
        "checked",
        "pending_manager",
        "pending_reviewer",
      ],
      content_type: ["text", "image", "pdf"],
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

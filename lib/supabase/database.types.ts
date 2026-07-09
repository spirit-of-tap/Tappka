export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      book_comments: {
        Row: {
          author_profile_id: string
          body: string
          book_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          body: string
          book_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          book_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_comments_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_comments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_comments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books_with_essay_count"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          added_by_profile_id: string
          ai_book_points: number | null
          ai_reason: string | null
          approved_at: string | null
          approved_by_profile_id: string | null
          author: string
          book_points: number
          cover_path: string | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          isbn_13: string | null
          legacy_book_points: number | null
          page_count: number | null
          preview_link: string | null
          rejection_reason: string | null
          source: Database["public"]["Enums"]["book_source"]
          status: Database["public"]["Enums"]["book_status"]
          suggested_points: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          added_by_profile_id: string
          ai_book_points?: number | null
          ai_reason?: string | null
          approved_at?: string | null
          approved_by_profile_id?: string | null
          author: string
          book_points?: number
          cover_path?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          isbn_13?: string | null
          legacy_book_points?: number | null
          page_count?: number | null
          preview_link?: string | null
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["book_source"]
          status?: Database["public"]["Enums"]["book_status"]
          suggested_points?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          added_by_profile_id?: string
          ai_book_points?: number | null
          ai_reason?: string | null
          approved_at?: string | null
          approved_by_profile_id?: string | null
          author?: string
          book_points?: number
          cover_path?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          isbn_13?: string | null
          legacy_book_points?: number | null
          page_count?: number | null
          preview_link?: string | null
          rejection_reason?: string | null
          source?: Database["public"]["Enums"]["book_source"]
          status?: Database["public"]["Enums"]["book_status"]
          suggested_points?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_added_by_profile_id_fkey"
            columns: ["added_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cowork_participants: {
        Row: {
          id: string
          joined_at: string
          reservation_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          reservation_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          reservation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cowork_participants_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cowork_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          profile_id: string
          updated_at: string
          widgets: Json
        }
        Insert: {
          profile_id: string
          updated_at?: string
          widgets?: Json
        }
        Update: {
          profile_id?: string
          updated_at?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_coach_reads: {
        Row: {
          coach_profile_id: string
          essay_id: string
          read_at: string
        }
        Insert: {
          coach_profile_id: string
          essay_id: string
          read_at?: string
        }
        Update: {
          coach_profile_id?: string
          essay_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_coach_reads_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_coach_reads_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_comments: {
        Row: {
          author_profile_id: string
          body: string
          created_at: string
          essay_id: string
          id: string
          is_linda_nudge: boolean
          nudge_status: string | null
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          body: string
          created_at?: string
          essay_id: string
          id?: string
          is_linda_nudge?: boolean
          nudge_status?: string | null
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          created_at?: string
          essay_id?: string
          id?: string
          is_linda_nudge?: boolean
          nudge_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_comments_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_comments_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_views: {
        Row: {
          essay_id: string
          first_viewed_at: string
          last_viewed_at: string
          viewer_profile_id: string
        }
        Insert: {
          essay_id: string
          first_viewed_at?: string
          last_viewed_at?: string
          viewer_profile_id: string
        }
        Update: {
          essay_id?: string
          first_viewed_at?: string
          last_viewed_at?: string
          viewer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_views_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_views_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_votes: {
        Row: {
          created_at: string
          essay_id: string
          voter_profile_id: string
        }
        Insert: {
          created_at?: string
          essay_id: string
          voter_profile_id: string
        }
        Update: {
          created_at?: string
          essay_id?: string
          voter_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_votes_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_votes_voter_profile_id_fkey"
            columns: ["voter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essays: {
        Row: {
          author_profile_id: string
          book_id: string | null
          content_json: Json
          content_text: string
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
          view_count: number
          vote_count: number
        }
        Insert: {
          author_profile_id: string
          book_id?: string | null
          content_json?: Json
          content_text?: string
          created_at?: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
          view_count?: number
          vote_count?: number
        }
        Update: {
          author_profile_id?: string
          book_id?: string | null
          content_json?: Json
          content_text?: string
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
          view_count?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "essays_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books_with_essay_count"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          beta_access: boolean
          created_at: string
          date_of_birth: string | null
          id: string
          name: string
          personal_email: string | null
          phone_number: string | null
          picture: string | null
          removed_access: string | null
          removed_access_by: string | null
          role: Database["public"]["Enums"]["profile_role"]
          team_id: string | null
          updated_at: string
          user_id: string | null
          work_email: string
        }
        Insert: {
          beta_access?: boolean
          created_at?: string
          date_of_birth?: string | null
          id?: string
          name: string
          personal_email?: string | null
          phone_number?: string | null
          picture?: string | null
          removed_access?: string | null
          removed_access_by?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          work_email: string
        }
        Update: {
          beta_access?: boolean
          created_at?: string
          date_of_birth?: string | null
          id?: string
          name?: string
          personal_email?: string | null
          phone_number?: string | null
          picture?: string | null
          removed_access?: string | null
          removed_access_by?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_removed_access_by_fkey"
            columns: ["removed_access_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          room_id: string
          start_time: string
          team_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week: number
          end_time: string
          id?: string
          room_id: string
          start_time: string
          team_id: string
          valid_from: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          room_id?: string
          start_time?: string
          team_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_cowork_open: boolean
          person_count: number | null
          recurring_schedule_id: string | null
          reservation_type: Database["public"]["Enums"]["reservation_type"]
          room_id: string
          start_time: string
          team_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_cowork_open?: boolean
          person_count?: number | null
          recurring_schedule_id?: string | null
          reservation_type?: Database["public"]["Enums"]["reservation_type"]
          room_id: string
          start_time: string
          team_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_cowork_open?: boolean
          person_count?: number | null
          recurring_schedule_id?: string | null
          reservation_type?: Database["public"]["Enums"]["reservation_type"]
          room_id?: string
          start_time?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_recurring_schedule_id_fkey"
            columns: ["recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_issues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          issue_type: Database["public"]["Enums"]["issue_type"]
          reported_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          room_id: string
          status: Database["public"]["Enums"]["issue_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          issue_type: Database["public"]["Enums"]["issue_type"]
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["issue_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          issue_type?: Database["public"]["Enums"]["issue_type"]
          reported_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["issue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "room_issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_issues_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          available_days: number[] | null
          can_have_ts: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          available_days?: number[] | null
          can_have_ts?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          available_days?: number[] | null
          can_have_ts?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      schedule_breaks: {
        Row: {
          break_type: Database["public"]["Enums"]["schedule_break_type"]
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          name: string
          start_date: string
        }
        Insert: {
          break_type: Database["public"]["Enums"]["schedule_break_type"]
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
        }
        Update: {
          break_type?: Database["public"]["Enums"]["schedule_break_type"]
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_breaks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_reading_list_books: {
        Row: {
          book_id: string
          list_id: string
          note: string | null
          position: number
        }
        Insert: {
          book_id: string
          list_id: string
          note?: string | null
          position?: number
        }
        Update: {
          book_id?: string
          list_id?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_reading_list_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_reading_list_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books_with_essay_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_reading_list_books_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "team_reading_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      team_reading_lists: {
        Row: {
          created_at: string
          created_by_profile_id: string
          id: string
          month: string | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          id?: string
          month?: string | null
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          id?: string
          month?: string | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_reading_lists_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_reading_lists_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          picture: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          picture?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          picture?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          google_email: string
          google_full_name: string | null
          google_profile_picture: string | null
          id: string
          last_otp_sent_at: string | null
          suggested_work_email: string | null
          updated_at: string
          verified_work_email: string | null
          verified_work_email_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          google_email: string
          google_full_name?: string | null
          google_profile_picture?: string | null
          id?: string
          last_otp_sent_at?: string | null
          suggested_work_email?: string | null
          updated_at?: string
          verified_work_email?: string | null
          verified_work_email_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          google_email?: string
          google_full_name?: string | null
          google_profile_picture?: string | null
          id?: string
          last_otp_sent_at?: string | null
          suggested_work_email?: string | null
          updated_at?: string
          verified_work_email?: string | null
          verified_work_email_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      books_with_essay_count: {
        Row: {
          added_by_profile_id: string | null
          ai_book_points: number | null
          ai_reason: string | null
          approved_at: string | null
          approved_by_profile_id: string | null
          author: string | null
          book_points: number | null
          cover_path: string | null
          created_at: string | null
          description: string | null
          essay_count: number | null
          external_id: string | null
          id: string | null
          isbn_13: string | null
          legacy_book_points: number | null
          page_count: number | null
          preview_link: string | null
          rejection_reason: string | null
          source: Database["public"]["Enums"]["book_source"] | null
          status: Database["public"]["Enums"]["book_status"] | null
          suggested_points: number | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_added_by_profile_id_fkey"
            columns: ["added_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      before_user_created_hook: { Args: { event: Json }; Returns: Json }
      coach_can_review_essay: { Args: { p_essay_id: string }; Returns: boolean }
      current_profile_id: { Args: never; Returns: string }
      get_best_books_per_category: {
        Args: { top_n?: number }
        Returns: {
          author: string
          book_points: number
          cover_path: string
          description: string
          essay_count: number
          id: string
          preview_link: string
          tag: string
          tags: string[]
          title: string
        }[]
      }
      get_teams_with_member_stats: {
        Args: never
        Returns: {
          book_points: number
          essay_count: number
          profile_id: string
          profile_name: string
          profile_picture: string
          team_id: string
          team_name: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_coach_or_admin: { Args: never; Returns: boolean }
      record_essay_view: { Args: { p_essay_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      book_source: "manual" | "google_books" | "open_library"
      book_status: "pending" | "approved" | "rejected"
      issue_status: "open" | "resolved"
      issue_type: "locked" | "mess" | "technical" | "other"
      profile_role: "student" | "mentor" | "coach" | "admin"
      reservation_type: "personal" | "training_session" | "houston_calling"
      schedule_break_type: "days_of_joy" | "holiday" | "other"
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
      book_source: ["manual", "google_books", "open_library"],
      book_status: ["pending", "approved", "rejected"],
      issue_status: ["open", "resolved"],
      issue_type: ["locked", "mess", "technical", "other"],
      profile_role: ["student", "mentor", "coach", "admin"],
      reservation_type: ["personal", "training_session", "houston_calling"],
      schedule_break_type: ["days_of_joy", "holiday", "other"],
    },
  },
} as const


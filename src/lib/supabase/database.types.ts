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
          created_by_profile_id: string
          id: string
          removed_at: string | null
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          author_profile_id: string
          body: string
          book_id: string
          created_at?: string
          created_by_profile_id: string
          id?: string
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          book_id?: string
          created_at?: string
          created_by_profile_id?: string
          id?: string
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string
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
          {
            foreignKeyName: "book_comments_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_comments_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_tags: {
        Row: {
          book_id: string
          created_at: string
          created_by_profile_id: string
          tag_id: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          created_by_profile_id: string
          tag_id: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          created_by_profile_id?: string
          tag_id?: string
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_tags_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_tags_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books_with_essay_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_tags_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_tags_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string
          book_points: number | null
          created_at: string
          created_by_profile_id: string
          description: string | null
          external_id: string | null
          id: string
          isbn_13: string | null
          page_count: number | null
          preview_link: string | null
          source: Database["public"]["Enums"]["book_source"]
          status: Database["public"]["Enums"]["book_status"]
          status_changed_at: string | null
          status_changed_by_profile_id: string | null
          status_reason: string | null
          supabase_cover_img_url: string | null
          title: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          author: string
          book_points?: number | null
          created_at?: string
          created_by_profile_id: string
          description?: string | null
          external_id?: string | null
          id?: string
          isbn_13?: string | null
          page_count?: number | null
          preview_link?: string | null
          source?: Database["public"]["Enums"]["book_source"]
          status?: Database["public"]["Enums"]["book_status"]
          status_changed_at?: string | null
          status_changed_by_profile_id?: string | null
          status_reason?: string | null
          supabase_cover_img_url?: string | null
          title: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          author?: string
          book_points?: number | null
          created_at?: string
          created_by_profile_id?: string
          description?: string | null
          external_id?: string | null
          id?: string
          isbn_13?: string | null
          page_count?: number | null
          preview_link?: string | null
          source?: Database["public"]["Enums"]["book_source"]
          status?: Database["public"]["Enums"]["book_status"]
          status_changed_at?: string | null
          status_changed_by_profile_id?: string | null
          status_reason?: string | null
          supabase_cover_img_url?: string | null
          title?: string
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_status_changed_by_profile_id_fkey"
            columns: ["status_changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          created_at: string
          created_by_profile_id: string
          profile_id: string
          updated_at: string
          updated_by_profile_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          profile_id: string
          updated_at?: string
          updated_by_profile_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          profile_id?: string
          updated_at?: string
          updated_by_profile_id?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_layouts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_layouts_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_coach_reads: {
        Row: {
          coach_profile_id: string
          created_at: string
          created_by_profile_id: string
          essay_id: string
          read_at: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          coach_profile_id: string
          created_at?: string
          created_by_profile_id: string
          essay_id: string
          read_at?: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          coach_profile_id?: string
          created_at?: string
          created_by_profile_id?: string
          essay_id?: string
          read_at?: string
          updated_at?: string
          updated_by_profile_id?: string
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
            foreignKeyName: "essay_coach_reads_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
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
          {
            foreignKeyName: "essay_coach_reads_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_comments: {
        Row: {
          author_profile_id: string
          body: string
          created_at: string
          created_by_profile_id: string
          essay_id: string
          id: string
          removed_at: string | null
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          author_profile_id: string
          body: string
          created_at?: string
          created_by_profile_id: string
          essay_id: string
          id?: string
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          created_at?: string
          created_by_profile_id?: string
          essay_id?: string
          id?: string
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string
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
            foreignKeyName: "essay_comments_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
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
          {
            foreignKeyName: "essay_comments_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_revisions: {
        Row: {
          content_json: Json
          created_at: string
          created_by_profile_id: string
          essay_id: string
          invalid_since: string | null
          revision_no: number
          title: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          content_json: Json
          created_at?: string
          created_by_profile_id: string
          essay_id: string
          invalid_since?: string | null
          revision_no: number
          title: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          created_by_profile_id?: string
          essay_id?: string
          invalid_since?: string | null
          revision_no?: number
          title?: string
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_revisions_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_revisions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_revisions_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_views: {
        Row: {
          created_at: string
          created_by_profile_id: string
          essay_id: string
          first_viewed_at: string
          last_viewed_at: string
          updated_at: string
          updated_by_profile_id: string
          viewer_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          essay_id: string
          first_viewed_at?: string
          last_viewed_at?: string
          updated_at?: string
          updated_by_profile_id: string
          viewer_profile_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          essay_id?: string
          first_viewed_at?: string
          last_viewed_at?: string
          updated_at?: string
          updated_by_profile_id?: string
          viewer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_views_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_views_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_views_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_by_profile_id: string
          essay_id: string
          updated_at: string
          updated_by_profile_id: string
          voter_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          essay_id: string
          updated_at?: string
          updated_by_profile_id: string
          voter_profile_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          essay_id?: string
          updated_at?: string
          updated_by_profile_id?: string
          voter_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_votes_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_votes_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_votes_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_at: string
          created_by_profile_id: string
          id: string
          pinned_at: string | null
          pinned_by_profile_id: string | null
          published_at: string | null
          removed_at: string | null
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          author_profile_id: string
          book_id?: string | null
          created_at?: string
          created_by_profile_id: string
          id?: string
          pinned_at?: string | null
          pinned_by_profile_id?: string | null
          published_at?: string | null
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          author_profile_id?: string
          book_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          id?: string
          pinned_at?: string | null
          pinned_by_profile_id?: string | null
          published_at?: string | null
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string
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
          {
            foreignKeyName: "essays_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_pinned_by_profile_id_fkey"
            columns: ["pinned_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          author_profile_id: string
          body: string
          created_at: string
          created_by_profile_id: string
          id: string
          resolved_at: string | null
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          author_profile_id: string
          body: string
          created_at?: string
          created_by_profile_id: string
          id?: string
          resolved_at?: string | null
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          created_at?: string
          created_by_profile_id?: string
          id?: string
          resolved_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_removed_at: string | null
          access_removed_by_profile_id: string | null
          beta_access_granted_at: string | null
          created_at: string
          created_by_profile_id: string | null
          date_of_birth: string | null
          id: string
          name: string | null
          personal_email: string | null
          phone_number: string | null
          picture: string | null
          role: Database["public"]["Enums"]["profile_role"]
          team_id: string | null
          updated_at: string
          updated_by_profile_id: string | null
          user_id: string | null
          work_email: string
        }
        Insert: {
          access_removed_at?: string | null
          access_removed_by_profile_id?: string | null
          beta_access_granted_at?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          date_of_birth?: string | null
          id?: string
          name?: string | null
          personal_email?: string | null
          phone_number?: string | null
          picture?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          team_id?: string | null
          updated_at?: string
          updated_by_profile_id?: string | null
          user_id?: string | null
          work_email: string
        }
        Update: {
          access_removed_at?: string | null
          access_removed_by_profile_id?: string | null
          beta_access_granted_at?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          date_of_birth?: string | null
          id?: string
          name?: string | null
          personal_email?: string | null
          phone_number?: string | null
          picture?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          team_id?: string | null
          updated_at?: string
          updated_by_profile_id?: string | null
          user_id?: string | null
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_access_removed_by_profile_id_fkey"
            columns: ["access_removed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
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
            foreignKeyName: "profiles_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_by_profile_id: string
          day_of_week: number
          end_time: string
          id: string
          removed_at: string | null
          room_id: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_time: string
          team_id: string | null
          updated_at: string
          updated_by_profile_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          day_of_week: number
          end_time: string
          id?: string
          removed_at?: string | null
          room_id: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_time: string
          team_id?: string | null
          updated_at?: string
          updated_by_profile_id: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          removed_at?: string | null
          room_id?: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          start_time?: string
          team_id?: string | null
          updated_at?: string
          updated_by_profile_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
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
          {
            foreignKeyName: "recurring_schedules_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancelled_at: string | null
          cancelled_by_profile_id: string | null
          created_at: string
          created_by_profile_id: string
          end_at: string
          id: string
          owner_profile_id: string | null
          person_count: number | null
          room_id: string
          start_at: string
          title: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by_profile_id?: string | null
          created_at?: string
          created_by_profile_id: string
          end_at: string
          id?: string
          owner_profile_id?: string | null
          person_count?: number | null
          room_id: string
          start_at: string
          title: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by_profile_id?: string | null
          created_at?: string
          created_by_profile_id?: string
          end_at?: string
          id?: string
          owner_profile_id?: string | null
          person_count?: number | null
          room_id?: string
          start_at?: string
          title?: string
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_cancelled_by_profile_id_fkey"
            columns: ["cancelled_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "reservations_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_by_profile_id: string
          description: string | null
          id: string
          name: string
          removed_at: string | null
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          available_days?: number[] | null
          can_have_ts?: boolean
          code: string
          created_at?: string
          created_by_profile_id: string
          description?: string | null
          id?: string
          name: string
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          available_days?: number[] | null
          can_have_ts?: boolean
          code?: string
          created_at?: string
          created_by_profile_id?: string
          description?: string | null
          id?: string
          name?: string
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_breaks: {
        Row: {
          created_at: string
          created_by_profile_id: string
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_breaks_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_breaks_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          created_by_profile_id: string
          id: string
          name: string
          updated_at: string
          updated_by_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id: string
          id?: string
          name: string
          updated_at?: string
          updated_by_profile_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          created_by_profile_id: string | null
          id: string
          name: string
          onboardingYear: number | null
          picture: string | null
          removed_at: string | null
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          id?: string
          name: string
          onboardingYear?: number | null
          picture?: string | null
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          id?: string
          name?: string
          onboardingYear?: number | null
          picture?: string | null
          removed_at?: string | null
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          google_email: string
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
          author: string | null
          book_points: number | null
          created_at: string | null
          created_by_profile_id: string | null
          description: string | null
          essay_count: number | null
          external_id: string | null
          id: string | null
          isbn_13: string | null
          page_count: number | null
          preview_link: string | null
          source: Database["public"]["Enums"]["book_source"] | null
          status: Database["public"]["Enums"]["book_status"] | null
          status_changed_at: string | null
          status_changed_by_profile_id: string | null
          status_reason: string | null
          supabase_cover_img_url: string | null
          title: string | null
          updated_at: string | null
          updated_by_profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_status_changed_by_profile_id_fkey"
            columns: ["status_changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
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
      profile_role: "student" | "mentor" | "coach" | "admin"
      schedule_type: "training_session" | "houston_calling"
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
      profile_role: ["student", "mentor", "coach", "admin"],
      schedule_type: ["training_session", "houston_calling"],
    },
  },
} as const


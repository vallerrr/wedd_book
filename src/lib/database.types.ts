export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          bingo_review_at: string | null
          capture_cost: number
          daily_photo_credits: number
          disposable_reveal_at: string | null
          event_end_date: string
          event_start_date: string
          gallery_visible: boolean
          id: number
          slideshow_enabled: boolean
          updated_at: string
          upload_cost: number
          venue_timezone: string
        }
        Insert: {
          bingo_review_at?: string | null
          capture_cost?: number
          daily_photo_credits?: number
          disposable_reveal_at?: string | null
          event_end_date?: string
          event_start_date?: string
          gallery_visible?: boolean
          id?: number
          slideshow_enabled?: boolean
          updated_at?: string
          upload_cost?: number
          venue_timezone?: string
        }
        Update: {
          bingo_review_at?: string | null
          capture_cost?: number
          daily_photo_credits?: number
          disposable_reveal_at?: string | null
          event_end_date?: string
          event_start_date?: string
          gallery_visible?: boolean
          id?: number
          slideshow_enabled?: boolean
          updated_at?: string
          upload_cost?: number
          venue_timezone?: string
        }
        Relationships: []
      }
      bingo_questions: {
        Row: {
          active: boolean
          id: string
          position: number
          prompt_en: string
          prompt_zh: string
        }
        Insert: {
          active?: boolean
          id?: string
          position: number
          prompt_en: string
          prompt_zh: string
        }
        Update: {
          active?: boolean
          id?: string
          position?: number
          prompt_en?: string
          prompt_zh?: string
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          body_en: string | null
          body_zh: string | null
          key: string
          position: number
          title_en: string | null
          title_zh: string | null
          visible: boolean
        }
        Insert: {
          body_en?: string | null
          body_zh?: string | null
          key: string
          position?: number
          title_en?: string | null
          title_zh?: string | null
          visible?: boolean
        }
        Update: {
          body_en?: string | null
          body_zh?: string | null
          key?: string
          position?: number
          title_en?: string | null
          title_zh?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      guestbook_entries: {
        Row: {
          created_at: string
          display_mode: string
          guest_id: string
          id: string
          message: string
          photo_id: string | null
        }
        Insert: {
          created_at?: string
          display_mode?: string
          guest_id: string
          id?: string
          message: string
          photo_id?: string | null
        }
        Update: {
          created_at?: string
          display_mode?: string
          guest_id?: string
          id?: string
          message?: string
          photo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guestbook_entries_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guestbook_entries_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          auth_user_id: string | null
          created_at: string
          default_anonymous: boolean
          display_name: string
          failed_attempts: number
          id: string
          invite_code: string
          last_seen_at: string | null
          locale: string
          redeemed_at: string | null
          table_number: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          default_anonymous?: boolean
          display_name: string
          failed_attempts?: number
          id?: string
          invite_code: string
          last_seen_at?: string | null
          locale?: string
          redeemed_at?: string | null
          table_number?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          default_anonymous?: boolean
          display_name?: string
          failed_attempts?: number
          id?: string
          invite_code?: string
          last_seen_at?: string | null
          locale?: string
          redeemed_at?: string | null
          table_number?: string | null
        }
        Relationships: []
      }
      photo_credits: {
        Row: {
          day: string
          guest_id: string
          used: number
        }
        Insert: {
          day: string
          guest_id: string
          used?: number
        }
        Update: {
          day?: string
          guest_id?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "photo_credits_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          bytes: number | null
          created_at: string
          credit_cost: number
          display_mode: string
          guest_id: string
          height: number | null
          id: string
          kind: string
          local_day: string
          question_id: string | null
          source: string
          status: string
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          credit_cost?: number
          display_mode?: string
          guest_id: string
          height?: number | null
          id?: string
          kind: string
          local_day: string
          question_id?: string | null
          source: string
          status?: string
          storage_path: string
          thumb_path?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          credit_cost?: number
          display_mode?: string
          guest_id?: string
          height?: number | null
          id?: string
          kind?: string
          local_day?: string
          question_id?: string | null
          source?: string
          status?: string
          storage_path?: string
          thumb_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "bingo_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      program_days: {
        Row: {
          day_date: string
          id: string
          intro_en: string | null
          intro_zh: string | null
          label_en: string
          label_zh: string
          position: number
        }
        Insert: {
          day_date: string
          id?: string
          intro_en?: string | null
          intro_zh?: string | null
          label_en: string
          label_zh: string
          position?: number
        }
        Update: {
          day_date?: string
          id?: string
          intro_en?: string | null
          intro_zh?: string | null
          label_en?: string
          label_zh?: string
          position?: number
        }
        Relationships: []
      }
      program_items: {
        Row: {
          address: string | null
          body_en: string | null
          body_zh: string | null
          category: string | null
          day_id: string
          id: string
          image_paths: string[]
          location_name: string | null
          map_url: string | null
          position: number
          starts_at: string | null
          time_label_en: string | null
          time_label_zh: string | null
          title_en: string
          title_zh: string
          visible: boolean
        }
        Insert: {
          address?: string | null
          body_en?: string | null
          body_zh?: string | null
          category?: string | null
          day_id: string
          id?: string
          image_paths?: string[]
          location_name?: string | null
          map_url?: string | null
          position?: number
          starts_at?: string | null
          time_label_en?: string | null
          time_label_zh?: string | null
          title_en: string
          title_zh: string
          visible?: boolean
        }
        Update: {
          address?: string | null
          body_en?: string | null
          body_zh?: string | null
          category?: string | null
          day_id?: string
          id?: string
          image_paths?: string[]
          location_name?: string | null
          map_url?: string | null
          position?: number
          starts_at?: string | null
          time_label_en?: string | null
          time_label_zh?: string | null
          title_en?: string
          title_zh?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "program_items_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_photo: {
        Args: { p: Database["public"]["Tables"]["photos"]["Row"] }
        Returns: boolean
      }
      can_view_photo_path: { Args: { p_path: string }; Returns: boolean }
      create_disposable_photo: {
        Args: {
          p_bytes?: number
          p_height?: number
          p_source: string
          p_storage_path: string
          p_thumb_path?: string
          p_width?: number
        }
        Returns: {
          bytes: number | null
          created_at: string
          credit_cost: number
          display_mode: string
          guest_id: string
          height: number | null
          id: string
          kind: string
          local_day: string
          question_id: string | null
          source: string
          status: string
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "photos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_guest_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      mark_photo_ready: { Args: { p_photo_id: string }; Returns: undefined }
      my_credits_remaining: { Args: never; Returns: number }
      redeem_invite_code: {
        Args: { p_code: string }
        Returns: {
          auth_user_id: string | null
          created_at: string
          default_anonymous: boolean
          display_name: string
          failed_attempts: number
          id: string
          invite_code: string
          last_seen_at: string | null
          locale: string
          redeemed_at: string | null
          table_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "guests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refund_failed_photo: { Args: { p_photo_id: string }; Returns: undefined }
      upsert_bingo_photo: {
        Args: {
          p_bytes?: number
          p_height?: number
          p_question_id: string
          p_source: string
          p_storage_path: string
          p_thumb_path?: string
          p_width?: number
        }
        Returns: {
          bytes: number | null
          created_at: string
          credit_cost: number
          display_mode: string
          guest_id: string
          height: number | null
          id: string
          kind: string
          local_day: string
          question_id: string | null
          source: string
          status: string
          storage_path: string
          thumb_path: string | null
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "photos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      venue_today: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


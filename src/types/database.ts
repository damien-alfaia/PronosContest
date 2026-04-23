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
      badges: {
        Row: {
          category: string
          code: string
          created_at: string
          description: Json
          icon: string
          libelle: Json
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description: Json
          icon: string
          libelle: Json
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: Json
          icon?: string
          libelle?: Json
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      competitions: {
        Row: {
          code: string
          created_at: string
          date_debut: string | null
          date_fin: string | null
          id: string
          logo_url: string | null
          nom: string
          sport: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          logo_url?: string | null
          nom: string
          sport: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          id?: string
          logo_url?: string | null
          nom?: string
          sport?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      concours: {
        Row: {
          code_invitation: string | null
          competition_id: string
          created_at: string
          description: string | null
          id: string
          jokers_enabled: boolean
          nom: string
          owner_id: string
          scoring_rules: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          code_invitation?: string | null
          competition_id: string
          created_at?: string
          description?: string | null
          id?: string
          jokers_enabled?: boolean
          nom: string
          owner_id: string
          scoring_rules?: Json
          updated_at?: string
          visibility?: string
        }
        Update: {
          code_invitation?: string | null
          competition_id?: string
          created_at?: string
          description?: string | null
          id?: string
          jokers_enabled?: boolean
          nom?: string
          owner_id?: string
          scoring_rules?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "concours_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      concours_messages: {
        Row: {
          body: string
          concours_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          concours_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          concours_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concours_messages_concours_id_fkey"
            columns: ["concours_id"]
            isOneToOne: false
            referencedRelation: "concours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concours_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concours_participants: {
        Row: {
          concours_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          concours_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          concours_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concours_participants_concours_id_fkey"
            columns: ["concours_id"]
            isOneToOne: false
            referencedRelation: "concours"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          code: string
          competition_id: string
          created_at: string
          drapeau_url: string | null
          fifa_id: number | null
          groupe: string | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          code: string
          competition_id: string
          created_at?: string
          drapeau_url?: string | null
          fifa_id?: number | null
          groupe?: string | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          code?: string
          competition_id?: string
          created_at?: string
          drapeau_url?: string | null
          fifa_id?: number | null
          groupe?: string | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      jokers: {
        Row: {
          category: string
          code: string
          created_at: string
          description: Json
          icon: string
          libelle: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description: Json
          icon: string
          libelle: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: Json
          icon?: string
          libelle?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      matchs: {
        Row: {
          competition_id: string
          cote_a: number | null
          cote_b: number | null
          cote_nul: number | null
          created_at: string
          equipe_a_id: string | null
          equipe_b_id: string | null
          fifa_match_id: number | null
          id: string
          kick_off_at: string
          penalty_score_a: number | null
          penalty_score_b: number | null
          phase: string
          round: number | null
          score_a: number | null
          score_b: number | null
          status: string
          updated_at: string
          vainqueur_tab: string | null
          venue_name: string | null
        }
        Insert: {
          competition_id: string
          cote_a?: number | null
          cote_b?: number | null
          cote_nul?: number | null
          created_at?: string
          equipe_a_id?: string | null
          equipe_b_id?: string | null
          fifa_match_id?: number | null
          id?: string
          kick_off_at: string
          penalty_score_a?: number | null
          penalty_score_b?: number | null
          phase: string
          round?: number | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          updated_at?: string
          vainqueur_tab?: string | null
          venue_name?: string | null
        }
        Update: {
          competition_id?: string
          cote_a?: number | null
          cote_b?: number | null
          cote_nul?: number | null
          created_at?: string
          equipe_a_id?: string | null
          equipe_b_id?: string | null
          fifa_match_id?: number | null
          id?: string
          kick_off_at?: string
          penalty_score_a?: number | null
          penalty_score_b?: number | null
          phase?: string
          round?: number | null
          score_a?: number | null
          score_b?: number | null
          status?: string
          updated_at?: string
          vainqueur_tab?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchs_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchs_equipe_a_id_fkey"
            columns: ["equipe_a_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchs_equipe_b_id_fkey"
            columns: ["equipe_b_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          locale: string
          nom: string | null
          prenom: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          locale?: string
          nom?: string | null
          prenom?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string
          nom?: string | null
          prenom?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      pronos: {
        Row: {
          concours_id: string
          created_at: string
          match_id: string
          score_a: number
          score_b: number
          updated_at: string
          user_id: string
          vainqueur_tab: string | null
        }
        Insert: {
          concours_id: string
          created_at?: string
          match_id: string
          score_a: number
          score_b: number
          updated_at?: string
          user_id: string
          vainqueur_tab?: string | null
        }
        Update: {
          concours_id?: string
          created_at?: string
          match_id?: string
          score_a?: number
          score_b?: number
          updated_at?: string
          user_id?: string
          vainqueur_tab?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pronos_concours_id_fkey"
            columns: ["concours_id"]
            isOneToOne: false
            referencedRelation: "concours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matchs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          metadata: Json
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
      user_jokers: {
        Row: {
          acquired_at: string
          acquired_from: string
          concours_id: string
          id: string
          joker_code: string
          used_at: string | null
          used_on_match_id: string | null
          used_on_target_user_id: string | null
          used_payload: Json | null
          user_id: string
        }
        Insert: {
          acquired_at?: string
          acquired_from: string
          concours_id: string
          id?: string
          joker_code: string
          used_at?: string | null
          used_on_match_id?: string | null
          used_on_target_user_id?: string | null
          used_payload?: Json | null
          user_id: string
        }
        Update: {
          acquired_at?: string
          acquired_from?: string
          concours_id?: string
          id?: string
          joker_code?: string
          used_at?: string | null
          used_on_match_id?: string | null
          used_on_target_user_id?: string | null
          used_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_jokers_concours_id_fkey"
            columns: ["concours_id"]
            isOneToOne: false
            referencedRelation: "concours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_jokers_joker_code_fkey"
            columns: ["joker_code"]
            isOneToOne: false
            referencedRelation: "jokers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_jokers_used_on_match_id_fkey"
            columns: ["used_on_match_id"]
            isOneToOne: false
            referencedRelation: "matchs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_classement_concours: {
        Row: {
          avatar_url: string | null
          concours_id: string | null
          nom: string | null
          points: number | null
          prenom: string | null
          pronos_exacts: number | null
          pronos_gagnes: number | null
          pronos_joues: number | null
          rang: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concours_participants_concours_id_fkey"
            columns: ["concours_id"]
            isOneToOne: false
            referencedRelation: "concours"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pronos_points: {
        Row: {
          bonus_ko: number | null
          concours_id: string | null
          cote_appliquee: number | null
          is_exact: boolean | null
          is_final: boolean | null
          match_id: string | null
          match_status: string | null
          phase: string | null
          points_base: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pronos_concours_id_fkey"
            columns: ["concours_id"]
            isOneToOne: false
            referencedRelation: "concours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronos_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matchs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_badge: {
        Args: { p_badge_code: string; p_metadata?: Json; p_user_id: string }
        Returns: undefined
      }
      award_joker: {
        Args: {
          p_acquired_from: string
          p_concours_id: string
          p_joker_code: string
          p_user_id: string
        }
        Returns: undefined
      }
      badge_to_joker_code: { Args: { p_badge_code: string }; Returns: string }
      generate_concours_code: { Args: never; Returns: string }
      is_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_concours_jokers_enabled: {
        Args: { p_concours_id: string }
        Returns: boolean
      }
      is_match_locked: { Args: { p_match_id: string }; Returns: boolean }
      is_participant: { Args: { p_concours_id: string }; Returns: boolean }
      join_concours_by_code: { Args: { p_code: string }; Returns: string }
      jokers_starter_codes: { Args: never; Returns: string[] }
      push_notification: {
        Args: { p_payload?: Json; p_type: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "user" | "admin"
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
    Enums: {
      user_role: ["user", "admin"],
    },
  },
} as const


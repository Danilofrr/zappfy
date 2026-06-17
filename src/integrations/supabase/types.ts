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
      ads: {
        Row: {
          created_at: string
          date: string
          id: string
          invested: number
          purchases: number
          revenue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          invested?: number
          purchases?: number
          revenue?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          invested?: number
          purchases?: number
          revenue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          city: string
          created_at: string
          customer: string
          date: string
          district: string
          id: string
          items: Json
          notes: string | null
          payment: string
          phone: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          city?: string
          created_at?: string
          customer: string
          date?: string
          district?: string
          id?: string
          items?: Json
          notes?: string | null
          payment?: string
          phone?: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          customer?: string
          date?: string
          district?: string
          id?: string
          items?: Json
          notes?: string | null
          payment?: string
          phone?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          price: number
          stock: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          price?: number
          stock?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          price?: number
          stock?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string
          checkout_bg_color: string
          checkout_button_color: string
          checkout_button_label: string
          checkout_card_color: string
          checkout_footer_bg_color: string | null
          checkout_footer_brand: string | null
          checkout_footer_cards_image_height: number | null
          checkout_footer_cards_image_url: string | null
          checkout_footer_cnpj: string | null
          checkout_footer_copyright: string | null
          checkout_footer_email: string | null
          checkout_footer_enabled: boolean | null
          checkout_footer_payments: string | null
          checkout_footer_show_cards_image: boolean | null
          checkout_footer_show_cnpj: boolean | null
          checkout_footer_show_email: boolean | null
          checkout_footer_show_whatsapp: boolean | null
          checkout_footer_whatsapp: string | null
          checkout_header_bg_color: string
          checkout_logo_align: string | null
          checkout_logo_size: number | null
          checkout_logo_url: string
          checkout_neon_color: string
          checkout_secure_color: string | null
          checkout_secure_label: string | null
          checkout_step_button_color: string | null
          checkout_step_button_text_color: string | null
          checkout_step1_button_label: string | null
          checkout_step1_title: string | null
          checkout_step2_button_label: string | null
          checkout_step2_title: string | null
          checkout_step3_button_label: string | null
          checkout_step3_title: string | null
          checkout_text_color: string
          checkout_theme: string
          created_at: string
          delivery_fee: number
          delivery_label: string
          delivery_message_template: string | null
          monthly_profit_goal: number
          monthly_revenue_goal: number
          motoboy_message_template: string | null
          pix_key: string
          shipping_options: Json | null
          slug: string | null
          store_name: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          address?: string
          checkout_bg_color?: string
          checkout_button_color?: string
          checkout_button_label?: string
          checkout_card_color?: string
          checkout_footer_bg_color?: string | null
          checkout_footer_brand?: string | null
          checkout_footer_cards_image_height?: number | null
          checkout_footer_cards_image_url?: string | null
          checkout_footer_cnpj?: string | null
          checkout_footer_copyright?: string | null
          checkout_footer_email?: string | null
          checkout_footer_enabled?: boolean | null
          checkout_footer_payments?: string | null
          checkout_footer_show_cards_image?: boolean | null
          checkout_footer_show_cnpj?: boolean | null
          checkout_footer_show_email?: boolean | null
          checkout_footer_show_whatsapp?: boolean | null
          checkout_footer_whatsapp?: string | null
          checkout_header_bg_color?: string
          checkout_logo_align?: string | null
          checkout_logo_size?: number | null
          checkout_logo_url?: string
          checkout_neon_color?: string
          checkout_secure_color?: string | null
          checkout_secure_label?: string | null
          checkout_step_button_color?: string | null
          checkout_step_button_text_color?: string | null
          checkout_step1_button_label?: string | null
          checkout_step1_title?: string | null
          checkout_step2_button_label?: string | null
          checkout_step2_title?: string | null
          checkout_step3_button_label?: string | null
          checkout_step3_title?: string | null
          checkout_text_color?: string
          checkout_theme?: string
          created_at?: string
          delivery_fee?: number
          delivery_label?: string
          delivery_message_template?: string | null
          monthly_profit_goal?: number
          monthly_revenue_goal?: number
          motoboy_message_template?: string | null
          pix_key?: string
          shipping_options?: Json | null
          slug?: string | null
          store_name?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          address?: string
          checkout_bg_color?: string
          checkout_button_color?: string
          checkout_button_label?: string
          checkout_card_color?: string
          checkout_footer_bg_color?: string | null
          checkout_footer_brand?: string | null
          checkout_footer_cards_image_height?: number | null
          checkout_footer_cards_image_url?: string | null
          checkout_footer_cnpj?: string | null
          checkout_footer_copyright?: string | null
          checkout_footer_email?: string | null
          checkout_footer_enabled?: boolean | null
          checkout_footer_payments?: string | null
          checkout_footer_show_cards_image?: boolean | null
          checkout_footer_show_cnpj?: boolean | null
          checkout_footer_show_email?: boolean | null
          checkout_footer_show_whatsapp?: boolean | null
          checkout_footer_whatsapp?: string | null
          checkout_header_bg_color?: string
          checkout_logo_align?: string | null
          checkout_logo_size?: number | null
          checkout_logo_url?: string
          checkout_neon_color?: string
          checkout_secure_color?: string | null
          checkout_secure_label?: string | null
          checkout_step_button_color?: string | null
          checkout_step_button_text_color?: string | null
          checkout_step1_button_label?: string | null
          checkout_step1_title?: string | null
          checkout_step2_button_label?: string | null
          checkout_step2_title?: string | null
          checkout_step3_button_label?: string | null
          checkout_step3_title?: string | null
          checkout_text_color?: string
          checkout_theme?: string
          created_at?: string
          delivery_fee?: number
          delivery_label?: string
          delivery_message_template?: string | null
          monthly_profit_goal?: number
          monthly_revenue_goal?: number
          motoboy_message_template?: string | null
          pix_key?: string
          shipping_options?: Json | null
          slug?: string | null
          store_name?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
    }
    Views: {
      products_public: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          name: string | null
          price: number | null
          stock: number | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          price?: number | null
          stock?: number | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          price?: number | null
          stock?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      settings_public: {
        Row: {
          checkout_bg_color: string | null
          checkout_button_color: string | null
          checkout_button_label: string | null
          checkout_card_color: string | null
          checkout_footer_bg_color: string | null
          checkout_footer_brand: string | null
          checkout_footer_cards_image_height: number | null
          checkout_footer_cards_image_url: string | null
          checkout_footer_cnpj: string | null
          checkout_footer_copyright: string | null
          checkout_footer_email: string | null
          checkout_footer_enabled: boolean | null
          checkout_footer_payments: string | null
          checkout_footer_show_cards_image: boolean | null
          checkout_footer_show_cnpj: boolean | null
          checkout_footer_show_email: boolean | null
          checkout_footer_show_whatsapp: boolean | null
          checkout_footer_whatsapp: string | null
          checkout_header_bg_color: string | null
          checkout_logo_align: string | null
          checkout_logo_size: number | null
          checkout_logo_url: string | null
          checkout_neon_color: string | null
          checkout_secure_color: string | null
          checkout_secure_label: string | null
          checkout_step_button_color: string | null
          checkout_step_button_text_color: string | null
          checkout_step1_button_label: string | null
          checkout_step1_title: string | null
          checkout_step2_button_label: string | null
          checkout_step2_title: string | null
          checkout_step3_button_label: string | null
          checkout_step3_title: string | null
          checkout_text_color: string | null
          checkout_theme: string | null
          delivery_fee: number | null
          delivery_label: string | null
          shipping_options: Json | null
          slug: string | null
          store_name: string | null
          user_id: string | null
        }
        Insert: {
          checkout_bg_color?: string | null
          checkout_button_color?: string | null
          checkout_button_label?: string | null
          checkout_card_color?: string | null
          checkout_footer_bg_color?: string | null
          checkout_footer_brand?: string | null
          checkout_footer_cards_image_height?: number | null
          checkout_footer_cards_image_url?: string | null
          checkout_footer_cnpj?: string | null
          checkout_footer_copyright?: string | null
          checkout_footer_email?: string | null
          checkout_footer_enabled?: boolean | null
          checkout_footer_payments?: string | null
          checkout_footer_show_cards_image?: boolean | null
          checkout_footer_show_cnpj?: boolean | null
          checkout_footer_show_email?: boolean | null
          checkout_footer_show_whatsapp?: boolean | null
          checkout_footer_whatsapp?: string | null
          checkout_header_bg_color?: string | null
          checkout_logo_align?: string | null
          checkout_logo_size?: number | null
          checkout_logo_url?: string | null
          checkout_neon_color?: string | null
          checkout_secure_color?: string | null
          checkout_secure_label?: string | null
          checkout_step_button_color?: string | null
          checkout_step_button_text_color?: string | null
          checkout_step1_button_label?: string | null
          checkout_step1_title?: string | null
          checkout_step2_button_label?: string | null
          checkout_step2_title?: string | null
          checkout_step3_button_label?: string | null
          checkout_step3_title?: string | null
          checkout_text_color?: string | null
          checkout_theme?: string | null
          delivery_fee?: number | null
          delivery_label?: string | null
          shipping_options?: Json | null
          slug?: string | null
          store_name?: string | null
          user_id?: string | null
        }
        Update: {
          checkout_bg_color?: string | null
          checkout_button_color?: string | null
          checkout_button_label?: string | null
          checkout_card_color?: string | null
          checkout_footer_bg_color?: string | null
          checkout_footer_brand?: string | null
          checkout_footer_cards_image_height?: number | null
          checkout_footer_cards_image_url?: string | null
          checkout_footer_cnpj?: string | null
          checkout_footer_copyright?: string | null
          checkout_footer_email?: string | null
          checkout_footer_enabled?: boolean | null
          checkout_footer_payments?: string | null
          checkout_footer_show_cards_image?: boolean | null
          checkout_footer_show_cnpj?: boolean | null
          checkout_footer_show_email?: boolean | null
          checkout_footer_show_whatsapp?: boolean | null
          checkout_footer_whatsapp?: string | null
          checkout_header_bg_color?: string | null
          checkout_logo_align?: string | null
          checkout_logo_size?: number | null
          checkout_logo_url?: string | null
          checkout_neon_color?: string | null
          checkout_secure_color?: string | null
          checkout_secure_label?: string | null
          checkout_step_button_color?: string | null
          checkout_step_button_text_color?: string | null
          checkout_step1_button_label?: string | null
          checkout_step1_title?: string | null
          checkout_step2_button_label?: string | null
          checkout_step2_title?: string | null
          checkout_step3_button_label?: string | null
          checkout_step3_title?: string | null
          checkout_text_color?: string | null
          checkout_theme?: string | null
          delivery_fee?: number | null
          delivery_label?: string | null
          shipping_options?: Json | null
          slug?: string | null
          store_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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

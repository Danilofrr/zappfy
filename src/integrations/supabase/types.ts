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
      access_logs: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          ip: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activation_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
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
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          uses: number
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses?: number
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      delivery_tracking: {
        Row: {
          accuracy: number | null
          completed_at: string | null
          courier_name: string | null
          courier_phone: string | null
          courier_token: string
          created_at: string
          customer_view_count: number
          delivery_latitude: number | null
          delivery_longitude: number | null
          estimated_arrival: string | null
          heading: number | null
          id: string
          last_updated_at: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string
          speed: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          tracking_code: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          completed_at?: string | null
          courier_name?: string | null
          courier_phone?: string | null
          courier_token: string
          created_at?: string
          customer_view_count?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_arrival?: string | null
          heading?: number | null
          id?: string
          last_updated_at?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id: string
          speed?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          tracking_code: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          completed_at?: string | null
          courier_name?: string | null
          courier_phone?: string | null
          courier_token?: string
          created_at?: string
          customer_view_count?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_arrival?: string | null
          heading?: number | null
          id?: string
          last_updated_at?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string
          speed?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id?: string
          tracking_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tracking_settings: {
        Row: {
          background_color: string | null
          border_intensity: number
          button_color: string | null
          card_border_color: string
          card_color: string
          card_glass: boolean
          card_opacity: number
          card_radius: number
          card_shadow: string
          card_shadow_color: string
          courier_background_color: string | null
          courier_button_color: string | null
          courier_card_border_color: string | null
          courier_card_color: string | null
          courier_card_shadow_color: string | null
          courier_footer_text: string | null
          courier_header_color: string | null
          courier_header_height: number | null
          courier_header_logo_align: string | null
          courier_header_logo_size: number | null
          courier_header_style: string | null
          courier_icon_color: string | null
          courier_inherit_client: boolean | null
          courier_logo_url: string | null
          courier_primary_color: string | null
          courier_secondary_color: string | null
          courier_text_color: string | null
          courier_title_color: string | null
          created_at: string
          delivered_message: string | null
          header_color: string
          header_height: number
          header_logo_align: string
          header_logo_size: number
          header_style: string
          id: string
          logo_url: string | null
          msg_aguardando: string
          msg_cancelado: string
          msg_chegando: string
          msg_entregue: string
          msg_preparando: string
          msg_saiu: string
          pin_color: string
          pin_custom_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_courier_name: boolean
          show_courier_phone: boolean
          show_distance: boolean
          show_estimated_time: boolean
          show_store_logo: boolean
          status_color: string
          status_styles: Json
          store_id: string
          support_whatsapp: string | null
          text_color: string | null
          timeline_color: string
          title_color: string
          tracking_page_subtitle: string | null
          tracking_page_title: string | null
          updated_at: string
          vehicle_color: string
          vehicle_custom_url: string | null
          vehicle_type: string
          welcome_message: string | null
        }
        Insert: {
          background_color?: string | null
          border_intensity?: number
          button_color?: string | null
          card_border_color?: string
          card_color?: string
          card_glass?: boolean
          card_opacity?: number
          card_radius?: number
          card_shadow?: string
          card_shadow_color?: string
          courier_background_color?: string | null
          courier_button_color?: string | null
          courier_card_border_color?: string | null
          courier_card_color?: string | null
          courier_card_shadow_color?: string | null
          courier_footer_text?: string | null
          courier_header_color?: string | null
          courier_header_height?: number | null
          courier_header_logo_align?: string | null
          courier_header_logo_size?: number | null
          courier_header_style?: string | null
          courier_icon_color?: string | null
          courier_inherit_client?: boolean | null
          courier_logo_url?: string | null
          courier_primary_color?: string | null
          courier_secondary_color?: string | null
          courier_text_color?: string | null
          courier_title_color?: string | null
          created_at?: string
          delivered_message?: string | null
          header_color?: string
          header_height?: number
          header_logo_align?: string
          header_logo_size?: number
          header_style?: string
          id?: string
          logo_url?: string | null
          msg_aguardando?: string
          msg_cancelado?: string
          msg_chegando?: string
          msg_entregue?: string
          msg_preparando?: string
          msg_saiu?: string
          pin_color?: string
          pin_custom_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_courier_name?: boolean
          show_courier_phone?: boolean
          show_distance?: boolean
          show_estimated_time?: boolean
          show_store_logo?: boolean
          status_color?: string
          status_styles?: Json
          store_id: string
          support_whatsapp?: string | null
          text_color?: string | null
          timeline_color?: string
          title_color?: string
          tracking_page_subtitle?: string | null
          tracking_page_title?: string | null
          updated_at?: string
          vehicle_color?: string
          vehicle_custom_url?: string | null
          vehicle_type?: string
          welcome_message?: string | null
        }
        Update: {
          background_color?: string | null
          border_intensity?: number
          button_color?: string | null
          card_border_color?: string
          card_color?: string
          card_glass?: boolean
          card_opacity?: number
          card_radius?: number
          card_shadow?: string
          card_shadow_color?: string
          courier_background_color?: string | null
          courier_button_color?: string | null
          courier_card_border_color?: string | null
          courier_card_color?: string | null
          courier_card_shadow_color?: string | null
          courier_footer_text?: string | null
          courier_header_color?: string | null
          courier_header_height?: number | null
          courier_header_logo_align?: string | null
          courier_header_logo_size?: number | null
          courier_header_style?: string | null
          courier_icon_color?: string | null
          courier_inherit_client?: boolean | null
          courier_logo_url?: string | null
          courier_primary_color?: string | null
          courier_secondary_color?: string | null
          courier_text_color?: string | null
          courier_title_color?: string | null
          created_at?: string
          delivered_message?: string | null
          header_color?: string
          header_height?: number
          header_logo_align?: string
          header_logo_size?: number
          header_style?: string
          id?: string
          logo_url?: string | null
          msg_aguardando?: string
          msg_cancelado?: string
          msg_chegando?: string
          msg_entregue?: string
          msg_preparando?: string
          msg_saiu?: string
          pin_color?: string
          pin_custom_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_courier_name?: boolean
          show_courier_phone?: boolean
          show_distance?: boolean
          show_estimated_time?: boolean
          show_store_logo?: boolean
          status_color?: string
          status_styles?: Json
          store_id?: string
          support_whatsapp?: string | null
          text_color?: string | null
          timeline_color?: string
          title_color?: string
          tracking_page_subtitle?: string | null
          tracking_page_title?: string | null
          updated_at?: string
          vehicle_color?: string
          vehicle_custom_url?: string | null
          vehicle_type?: string
          welcome_message?: string | null
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
      notification_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
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
      plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
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
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_date: string
          product_id: string | null
          product_name: string
          quantity: number
          received_date: string | null
          status: string
          supplier_id: string | null
          supplier_name: string
          total: number
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_date?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          received_date?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          total?: number
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_date?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          received_date?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          total?: number
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          id: string
          new_product_name: string | null
          notes: string | null
          order_id: string | null
          party_name: string
          product_id: string | null
          product_name: string
          quantity: number
          reason: string | null
          return_date: string
          status: string
          type: string
          updated_at: string
          user_id: string
          value_at_risk: number
        }
        Insert: {
          created_at?: string
          id?: string
          new_product_name?: string | null
          notes?: string | null
          order_id?: string | null
          party_name?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          reason?: string | null
          return_date?: string
          status?: string
          type?: string
          updated_at?: string
          user_id: string
          value_at_risk?: number
        }
        Update: {
          created_at?: string
          id?: string
          new_product_name?: string | null
          notes?: string | null
          order_id?: string | null
          party_name?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          return_date?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          value_at_risk?: number
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
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
          motoboy_fee: number
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
          motoboy_fee?: number
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
          motoboy_fee?: number
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
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          due_at: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_at?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_at?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          expires_at: string | null
          id: string
          last_payment_at: string | null
          notes: string | null
          plan_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_payment_at?: string | null
          notes?: string | null
          plan_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_payment_at?: string | null
          notes?: string | null
          plan_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      products_public: {
        Row: {
          created_at: string | null
          id: string | null
          image_url: string | null
          name: string | null
          price: number | null
          stock: number | null
          user_id: string | null
        }
        Relationships: []
      }
      settings_public: {
        Row: {
          address: string | null
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
          motoboy_fee: number | null
          shipping_options: Json | null
          slug: string | null
          store_name: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
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
          motoboy_fee?: number | null
          shipping_options?: Json | null
          slug?: string | null
          store_name?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
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
          motoboy_fee?: number | null
          shipping_options?: Json | null
          slug?: string | null
          store_name?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_clients: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          plan_id: string
          plan_name: string
          price_monthly: number
          roles: string[]
          store_name: string
          sub_expires_at: string
          sub_started_at: string
          sub_status: string
          whatsapp: string
        }[]
      }
      get_courier_view: { Args: { _token: string }; Returns: Json }
      get_tracking_public: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_tracking_view: { Args: { _code: string }; Returns: undefined }
      set_tracking_destination: {
        Args: { _code: string; _lat: number; _lng: number }
        Returns: boolean
      }
      submit_public_order: {
        Args: {
          _address: string
          _cep: string
          _city: string
          _customer: string
          _district: string
          _notes?: string
          _payment: string
          _phone: string
          _product_id: string
          _quantity: number
          _reference: string
          _shipping_value: number
          _slug: string
          _total: number
          _unit_price: number
        }
        Returns: string
      }
      update_courier_location: {
        Args: {
          _accuracy?: number
          _heading?: number
          _lat: number
          _lng: number
          _speed?: number
          _token: string
        }
        Returns: boolean
      }
      update_courier_status: {
        Args: { _status: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cliente"
      delivery_status:
        | "preparando"
        | "aguardando_motoboy"
        | "saiu_para_entrega"
        | "chegando"
        | "entregue"
        | "cancelado"
      payment_status: "pago" | "pendente" | "vencido" | "cancelado"
      subscription_status:
        | "ativo"
        | "teste"
        | "pendente"
        | "vencido"
        | "bloqueado"
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
      app_role: ["admin", "cliente"],
      delivery_status: [
        "preparando",
        "aguardando_motoboy",
        "saiu_para_entrega",
        "chegando",
        "entregue",
        "cancelado",
      ],
      payment_status: ["pago", "pendente", "vencido", "cancelado"],
      subscription_status: [
        "ativo",
        "teste",
        "pendente",
        "vencido",
        "bloqueado",
      ],
    },
  },
} as const

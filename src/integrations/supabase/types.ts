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
      courier_sessions: {
        Row: {
          courier_id: string
          created_at: string
          expires_at: string
          token: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          expires_at?: string
          token: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          expires_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_sessions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          password_hash: string
          phone: string
          plate: string | null
          store_id: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_login_at?: string | null
          name: string
          password_hash: string
          phone: string
          plate?: string | null
          store_id: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_login_at?: string | null
          name?: string
          password_hash?: string
          phone?: string
          plate?: string | null
          store_id?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      delivery_tracking: {
        Row: {
          accepted_at: string | null
          accuracy: number | null
          completed_at: string | null
          courier_id: string | null
          courier_name: string | null
          courier_phone: string | null
          courier_token: string
          created_at: string
          customer_view_count: number
          delivery_geocoded_address: string | null
          delivery_geocoding_status: string
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
          accepted_at?: string | null
          accuracy?: number | null
          completed_at?: string | null
          courier_id?: string | null
          courier_name?: string | null
          courier_phone?: string | null
          courier_token: string
          created_at?: string
          customer_view_count?: number
          delivery_geocoded_address?: string | null
          delivery_geocoding_status?: string
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
          accepted_at?: string | null
          accuracy?: number | null
          completed_at?: string | null
          courier_id?: string | null
          courier_name?: string | null
          courier_phone?: string | null
          courier_token?: string
          created_at?: string
          customer_view_count?: number
          delivery_geocoded_address?: string | null
          delivery_geocoding_status?: string
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
          show_product_price: boolean
          show_products: boolean
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
          show_product_price?: boolean
          show_products?: boolean
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
          show_product_price?: boolean
          show_products?: boolean
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
          store_id: string
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
          store_id: string
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
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_webhook_logs: {
        Row: {
          created_at: string
          customer_email: string | null
          error_message: string | null
          event_type: string | null
          id: string
          order_id: string | null
          payload: Json | null
          product_id: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          product_id?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          product_id?: string | null
          status?: string
          subscription_id?: string | null
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
          store_id: string
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
          store_id: string
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
          store_id?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_cycle: string
          created_at: string
          description: string | null
          duration_days: number
          duration_days_monthly: number
          duration_days_quarterly: number
          duration_days_yearly: number
          features: Json
          id: string
          is_active: boolean
          kiwify_product_id: string | null
          kiwify_product_id_monthly: string | null
          kiwify_product_id_quarterly: string | null
          kiwify_product_id_yearly: string | null
          limits: Json
          name: string
          price: number
          price_monthly: number
          price_quarterly: number
          price_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          description?: string | null
          duration_days?: number
          duration_days_monthly?: number
          duration_days_quarterly?: number
          duration_days_yearly?: number
          features?: Json
          id?: string
          is_active?: boolean
          kiwify_product_id?: string | null
          kiwify_product_id_monthly?: string | null
          kiwify_product_id_quarterly?: string | null
          kiwify_product_id_yearly?: string | null
          limits?: Json
          name: string
          price?: number
          price_monthly?: number
          price_quarterly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          description?: string | null
          duration_days?: number
          duration_days_monthly?: number
          duration_days_quarterly?: number
          duration_days_yearly?: number
          features?: Json
          id?: string
          is_active?: boolean
          kiwify_product_id?: string | null
          kiwify_product_id_monthly?: string | null
          kiwify_product_id_quarterly?: string | null
          kiwify_product_id_yearly?: string | null
          limits?: Json
          name?: string
          price?: number
          price_monthly?: number
          price_quarterly?: number
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
          store_id: string
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
          store_id: string
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
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          customer_phone: string | null
          id: string
          new_product_id: string | null
          new_product_name: string | null
          notes: string | null
          order_date: string | null
          order_id: string | null
          party_name: string
          product_id: string | null
          product_name: string
          product_price: number
          quantity: number
          reason: string | null
          restocked: boolean
          return_date: string
          status: string
          store_id: string | null
          type: string
          updated_at: string
          user_id: string
          value_at_risk: number
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          id?: string
          new_product_id?: string | null
          new_product_name?: string | null
          notes?: string | null
          order_date?: string | null
          order_id?: string | null
          party_name?: string
          product_id?: string | null
          product_name: string
          product_price?: number
          quantity?: number
          reason?: string | null
          restocked?: boolean
          return_date?: string
          status?: string
          store_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
          value_at_risk?: number
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          id?: string
          new_product_id?: string | null
          new_product_name?: string | null
          notes?: string | null
          order_date?: string | null
          order_id?: string | null
          party_name?: string
          product_id?: string | null
          product_name?: string
          product_price?: number
          quantity?: number
          reason?: string | null
          restocked?: boolean
          return_date?: string
          status?: string
          store_id?: string | null
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
          ads_tax_pct: number
          card_fee_mode: string
          card_fee_pct: number
          card_machine_fees: Json
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
          customer_tracking_message_template: string | null
          delivery_fee: number
          delivery_label: string
          delivery_message_template: string | null
          fb_access_token: string | null
          fb_account_id: string | null
          fb_ad_account_id: string | null
          fb_ad_account_name: string | null
          fb_connection_status: string | null
          fb_currency: string | null
          fb_last_sync_at: string | null
          fb_last_sync_error: string | null
          fb_last_sync_status: string | null
          fb_timezone_name: string | null
          monthly_profit_goal: number
          monthly_revenue_goal: number
          motoboy_fee: number
          motoboy_message_template: string | null
          other_fees_pct: number
          pix_key: string
          platform_fee_pct: number
          shipping_options: Json | null
          slug: string | null
          store_id: string
          store_name: string
          tax_pct: number
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          address?: string
          ads_tax_pct?: number
          card_fee_mode?: string
          card_fee_pct?: number
          card_machine_fees?: Json
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
          customer_tracking_message_template?: string | null
          delivery_fee?: number
          delivery_label?: string
          delivery_message_template?: string | null
          fb_access_token?: string | null
          fb_account_id?: string | null
          fb_ad_account_id?: string | null
          fb_ad_account_name?: string | null
          fb_connection_status?: string | null
          fb_currency?: string | null
          fb_last_sync_at?: string | null
          fb_last_sync_error?: string | null
          fb_last_sync_status?: string | null
          fb_timezone_name?: string | null
          monthly_profit_goal?: number
          monthly_revenue_goal?: number
          motoboy_fee?: number
          motoboy_message_template?: string | null
          other_fees_pct?: number
          pix_key?: string
          platform_fee_pct?: number
          shipping_options?: Json | null
          slug?: string | null
          store_id: string
          store_name?: string
          tax_pct?: number
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          address?: string
          ads_tax_pct?: number
          card_fee_mode?: string
          card_fee_pct?: number
          card_machine_fees?: Json
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
          customer_tracking_message_template?: string | null
          delivery_fee?: number
          delivery_label?: string
          delivery_message_template?: string | null
          fb_access_token?: string | null
          fb_account_id?: string | null
          fb_ad_account_id?: string | null
          fb_ad_account_name?: string | null
          fb_connection_status?: string | null
          fb_currency?: string | null
          fb_last_sync_at?: string | null
          fb_last_sync_error?: string | null
          fb_last_sync_status?: string | null
          fb_timezone_name?: string | null
          monthly_profit_goal?: number
          monthly_revenue_goal?: number
          motoboy_fee?: number
          motoboy_message_template?: string | null
          other_fees_pct?: number
          pix_key?: string
          platform_fee_pct?: number
          shipping_options?: Json | null
          slug?: string | null
          store_id?: string
          store_name?: string
          tax_pct?: number
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
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
          invite_code: string | null
          kiwify_customer_email: string | null
          kiwify_order_id: string | null
          kiwify_subscription_id: string | null
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
          invite_code?: string | null
          kiwify_customer_email?: string | null
          kiwify_order_id?: string | null
          kiwify_subscription_id?: string | null
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
          invite_code?: string | null
          kiwify_customer_email?: string | null
          kiwify_order_id?: string | null
          kiwify_subscription_id?: string | null
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
      trial_invites: {
        Row: {
          code: string
          conversions_count: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          revoked_at: string | null
          signups_count: number
          status: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          code: string
          conversions_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          revoked_at?: string | null
          signups_count?: number
          status?: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          code?: string
          conversions_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          revoked_at?: string | null
          signups_count?: number
          status?: string
          trial_days?: number
          updated_at?: string
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
      zappfy_central_settings: {
        Row: {
          background_color: string
          brand_name: string
          button_color: string
          button_text_color: string
          card_border_color: string
          card_color: string
          card_radius: number
          card_shadow_color: string
          created_at: string
          footer_text: string
          header_color: string
          header_text_color: string
          icon_color: string
          id: string
          login_bg_color: string
          login_border_color: string
          login_button_color: string
          login_button_text_color: string
          login_card_color: string
          login_footer_text: string
          login_glow_color: string
          login_glow_enabled: boolean
          login_icon_size: number
          login_icon_url: string | null
          login_logo_url: string | null
          login_show_logo: boolean
          login_subtitle_text: string
          login_text_color: string
          login_title_color: string
          login_title_text: string
          logo_size: number
          logo_url: string | null
          text_color: string
          title_color: string
          updated_at: string
        }
        Insert: {
          background_color?: string
          brand_name?: string
          button_color?: string
          button_text_color?: string
          card_border_color?: string
          card_color?: string
          card_radius?: number
          card_shadow_color?: string
          created_at?: string
          footer_text?: string
          header_color?: string
          header_text_color?: string
          icon_color?: string
          id?: string
          login_bg_color?: string
          login_border_color?: string
          login_button_color?: string
          login_button_text_color?: string
          login_card_color?: string
          login_footer_text?: string
          login_glow_color?: string
          login_glow_enabled?: boolean
          login_icon_size?: number
          login_icon_url?: string | null
          login_logo_url?: string | null
          login_show_logo?: boolean
          login_subtitle_text?: string
          login_text_color?: string
          login_title_color?: string
          login_title_text?: string
          logo_size?: number
          logo_url?: string | null
          text_color?: string
          title_color?: string
          updated_at?: string
        }
        Update: {
          background_color?: string
          brand_name?: string
          button_color?: string
          button_text_color?: string
          card_border_color?: string
          card_color?: string
          card_radius?: number
          card_shadow_color?: string
          created_at?: string
          footer_text?: string
          header_color?: string
          header_text_color?: string
          icon_color?: string
          id?: string
          login_bg_color?: string
          login_border_color?: string
          login_button_color?: string
          login_button_text_color?: string
          login_card_color?: string
          login_footer_text?: string
          login_glow_color?: string
          login_glow_enabled?: boolean
          login_icon_size?: number
          login_icon_url?: string | null
          login_logo_url?: string | null
          login_show_logo?: boolean
          login_subtitle_text?: string
          login_text_color?: string
          login_title_color?: string
          login_title_text?: string
          logo_size?: number
          logo_url?: string | null
          text_color?: string
          title_color?: string
          updated_at?: string
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
          card_fee_mode: string | null
          card_fee_pct: number | null
          card_machine_fees: Json | null
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
          card_fee_mode?: string | null
          card_fee_pct?: number | null
          card_machine_fees?: Json | null
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
          card_fee_mode?: string | null
          card_fee_pct?: number | null
          card_machine_fees?: Json | null
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
      _can_manage_store: { Args: { _store_id: string }; Returns: boolean }
      _resolve_courier_session: {
        Args: { _session: string }
        Returns: {
          active: boolean
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          password_hash: string
          phone: string
          plate: string | null
          store_id: string
          updated_at: string
          vehicle_type: string | null
        }
        SetofOptions: {
          from: "*"
          to: "couriers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_delivery: {
        Args: { _code: string; _name: string; _phone?: string; _slug: string }
        Returns: Json
      }
      accept_delivery_v2: {
        Args: { _code: string; _session: string }
        Returns: Json
      }
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
      admin_trial_stats: { Args: never; Returns: Json }
      apply_tracking_default_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      courier_create_session: {
        Args: { _courier_id: string; _token: string }
        Returns: Json
      }
      courier_login: {
        Args: { _password: string; _phone: string; _slug: string }
        Returns: Json
      }
      courier_logout: { Args: { _session: string }; Returns: boolean }
      courier_me: { Args: { _session: string }; Returns: Json }
      courier_phone_matches: {
        Args: { _input_phone: string; _stored_phone: string }
        Returns: boolean
      }
      courier_phone_without_ddi: { Args: { _phone: string }; Returns: string }
      create_courier: {
        Args: {
          _active?: boolean
          _name: string
          _password_hash: string
          _phone: string
          _plate?: string
          _vehicle?: string
        }
        Returns: {
          active: boolean
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          password_hash: string
          phone: string
          plate: string | null
          store_id: string
          updated_at: string
          vehicle_type: string | null
        }
        SetofOptions: {
          from: "*"
          to: "couriers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_courier_for_store: {
        Args: {
          _active?: boolean
          _name: string
          _password: string
          _phone: string
          _plate?: string
          _store_id: string
          _vehicle?: string
        }
        Returns: Json
      }
      create_my_store: {
        Args: { _name: string; _slug?: string }
        Returns: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_courier: { Args: { _id: string }; Returns: boolean }
      delete_courier_for_store: {
        Args: { _id: string; _store_id: string }
        Returns: boolean
      }
      delete_my_store: { Args: { _store_id: string }; Returns: boolean }
      finalize_delivery_tracking: {
        Args: { _tracking_id: string }
        Returns: boolean
      }
      get_courier_view: { Args: { _token: string }; Returns: Json }
      get_store_by_slug: { Args: { _slug: string }; Returns: Json }
      get_tracking_public: { Args: { _code: string }; Returns: Json }
      get_trial_invite_info: { Args: { _code: string }; Returns: Json }
      get_zappfy_central_settings: {
        Args: never
        Returns: {
          background_color: string
          brand_name: string
          button_color: string
          button_text_color: string
          card_border_color: string
          card_color: string
          card_radius: number
          card_shadow_color: string
          created_at: string
          footer_text: string
          header_color: string
          header_text_color: string
          icon_color: string
          id: string
          login_bg_color: string
          login_border_color: string
          login_button_color: string
          login_button_text_color: string
          login_card_color: string
          login_footer_text: string
          login_glow_color: string
          login_glow_enabled: boolean
          login_icon_size: number
          login_icon_url: string | null
          login_logo_url: string | null
          login_show_logo: boolean
          login_subtitle_text: string
          login_text_color: string
          login_title_color: string
          login_title_text: string
          logo_size: number
          logo_url: string | null
          text_color: string
          title_color: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "zappfy_central_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_tracking_view: { Args: { _code: string }; Returns: undefined }
      list_available_deliveries: { Args: { _slug: string }; Returns: Json }
      list_available_deliveries_v2: {
        Args: { _session: string }
        Returns: Json
      }
      list_couriers_for_store: { Args: { _store_id: string }; Returns: Json }
      list_my_active_deliveries: { Args: { _session: string }; Returns: Json }
      list_my_stores: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "stores"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      normalize_courier_phone: { Args: { _phone: string }; Returns: string }
      redeem_trial_invite: { Args: { _code: string }; Returns: Json }
      reset_courier_password: {
        Args: { _id: string; _password_hash: string }
        Returns: boolean
      }
      reset_courier_password_for_store: {
        Args: { _id: string; _password: string; _store_id: string }
        Returns: boolean
      }
      set_tracking_destination:
        | {
            Args: { _code: string; _lat: number; _lng: number }
            Returns: boolean
          }
        | {
            Args: {
              _address?: string
              _code: string
              _lat: number
              _lng: number
              _status?: string
            }
            Returns: boolean
          }
      submit_public_order: {
        Args: {
          _address: string
          _cep: string
          _city: string
          _cpf?: string
          _customer: string
          _district: string
          _email?: string
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
      update_courier: {
        Args: {
          _active: boolean
          _id: string
          _name: string
          _phone: string
          _plate: string
          _vehicle: string
        }
        Returns: {
          active: boolean
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          password_hash: string
          phone: string
          plate: string | null
          store_id: string
          updated_at: string
          vehicle_type: string | null
        }
        SetofOptions: {
          from: "*"
          to: "couriers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_courier_for_store: {
        Args: {
          _active: boolean
          _id: string
          _name: string
          _phone: string
          _plate: string
          _store_id: string
          _vehicle: string
        }
        Returns: Json
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
      user_owns_store: { Args: { _store_id: string }; Returns: boolean }
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

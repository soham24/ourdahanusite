// AUTO-GENERATED from Supabase (project slmbqngmxketyxjauxxk).
// Regenerate with the Supabase generate_typescript_types tool. Shared with the native app for typed models.

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
      appointment_date_overrides: {
        Row: {
          closed: boolean
          created_at: string
          id: string
          listing_id: string
          note: string | null
          override_date: string
          windows: Json | null
        }
        Insert: {
          closed?: boolean
          created_at?: string
          id?: string
          listing_id: string
          note?: string | null
          override_date: string
          windows?: Json | null
        }
        Update: {
          closed?: boolean
          created_at?: string
          id?: string
          listing_id?: string
          note?: string | null
          override_date?: string
          windows?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_date_overrides_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          booking_date: string
          booking_fee: number
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string
          customer_reminder_sent_at: string | null
          id: string
          listing_id: string
          notes: string | null
          owner_reminder_sent_at: string | null
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          slot_end: string
          slot_start: string
          status: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string
          user_phone: string
        }
        Insert: {
          booking_date: string
          booking_fee?: number
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_reminder_sent_at?: string | null
          id?: string
          listing_id: string
          notes?: string | null
          owner_reminder_sent_at?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          slot_end: string
          slot_start: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name: string
          user_phone: string
        }
        Update: {
          booking_date?: string
          booking_fee?: number
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_reminder_sent_at?: string | null
          id?: string
          listing_id?: string
          notes?: string | null
          owner_reminder_sent_at?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          slot_end?: string
          slot_start?: string
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classifieds: {
        Row: {
          active: boolean | null
          approved: boolean | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          image: string | null
          location: string | null
          price: number | null
          seller_id: string | null
          seller_name: string | null
          title: string
          type: string
          urgent: boolean | null
        }
        Insert: {
          active?: boolean | null
          approved?: boolean | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image?: string | null
          location?: string | null
          price?: number | null
          seller_id?: string | null
          seller_name?: string | null
          title: string
          type: string
          urgent?: boolean | null
        }
        Update: {
          active?: boolean | null
          approved?: boolean | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          image?: string | null
          location?: string | null
          price?: number | null
          seller_id?: string | null
          seller_name?: string | null
          title?: string
          type?: string
          urgent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "classifieds_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cod_collections: {
        Row: {
          amount_paise: number
          created_at: string
          delivery_order_id: string
          id: string
          rider_id: string | null
          settled: boolean
        }
        Insert: {
          amount_paise: number
          created_at?: string
          delivery_order_id: string
          id?: string
          rider_id?: string | null
          settled?: boolean
        }
        Update: {
          amount_paise?: number
          created_at?: string
          delivery_order_id?: string
          id?: string
          rider_id?: string | null
          settled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cod_collections_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cod_collections_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount_paid: number
          coupon_code: string
          coupon_id: string | null
          id: string
          kind: string
          listing_id: string | null
          payment_id: string | null
          payment_status: string
          redeemed_at: string
          user_id: string | null
        }
        Insert: {
          amount_paid?: number
          coupon_code: string
          coupon_id?: string | null
          id?: string
          kind: string
          listing_id?: string | null
          payment_id?: string | null
          payment_status: string
          redeemed_at?: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number
          coupon_code?: string
          coupon_id?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          payment_id?: string | null
          payment_status?: string
          redeemed_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          assigned_to: string | null
          code: string
          created_at: string | null
          enabled: boolean
          final_price: number
          id: string
          label: string
          usage_count: number
        }
        Insert: {
          assigned_to?: string | null
          code: string
          created_at?: string | null
          enabled?: boolean
          final_price: number
          id?: string
          label: string
          usage_count?: number
        }
        Update: {
          assigned_to?: string | null
          code?: string
          created_at?: string | null
          enabled?: boolean
          final_price?: number
          id?: string
          label?: string
          usage_count?: number
        }
        Relationships: []
      }
      delivery_order_items: {
        Row: {
          delivery_order_id: string
          id: string
          line_total_paise: number
          listing_product_id: string | null
          name: string
          price_paise: number
          quantity: number
        }
        Insert: {
          delivery_order_id: string
          id?: string
          line_total_paise: number
          listing_product_id?: string | null
          name: string
          price_paise: number
          quantity: number
        }
        Update: {
          delivery_order_id?: string
          id?: string
          line_total_paise?: number
          listing_product_id?: string | null
          name?: string
          price_paise?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_listing_product_id_fkey"
            columns: ["listing_product_id"]
            isOneToOne: false
            referencedRelation: "listing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          assigned_at: string | null
          cancel_reason: string | null
          created_at: string
          customer_id: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_fee_paise: number
          distance_km: number | null
          drop_address: string
          drop_lat: number | null
          drop_lng: number | null
          grand_total_paise: number
          handoff_otp: string | null
          id: string
          items_total_paise: number
          listing_id: string
          notes: string | null
          payment_mode: string
          payment_status: string
          picked_up_at: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          rated: boolean
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          rider_id: string | null
          rider_rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_id: string
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_fee_paise?: number
          distance_km?: number | null
          drop_address: string
          drop_lat?: number | null
          drop_lng?: number | null
          grand_total_paise: number
          handoff_otp?: string | null
          id?: string
          items_total_paise: number
          listing_id: string
          notes?: string | null
          payment_mode: string
          payment_status?: string
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          rated?: boolean
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          rider_id?: string | null
          rider_rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_fee_paise?: number
          distance_km?: number | null
          drop_address?: string
          drop_lat?: number | null
          drop_lng?: number | null
          grand_total_paise?: number
          handoff_otp?: string | null
          id?: string
          items_total_paise?: number
          listing_id?: string
          notes?: string | null
          payment_mode?: string
          payment_status?: string
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          rated?: boolean
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          rider_id?: string | null
          rider_rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_alerts: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          severity: string
          title: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          severity: string
          title: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          approved: boolean | null
          category: string
          created_at: string | null
          date: string
          description: string | null
          id: string
          image_url: string | null
          is_free: boolean | null
          location: string
          max_attendees: number | null
          organizer_id: string | null
          price: number | null
          time_end: string | null
          time_start: string | null
          title: string
        }
        Insert: {
          approved?: boolean | null
          category: string
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean | null
          location: string
          max_attendees?: number | null
          organizer_id?: string | null
          price?: number | null
          time_end?: string | null
          time_start?: string | null
          title: string
        }
        Update: {
          approved?: boolean | null
          category?: string
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean | null
          location?: string
          max_attendees?: number | null
          organizer_id?: string | null
          price?: number | null
          time_end?: string | null
          time_start?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      find_professionals: {
        Row: {
          business_listing_id: string | null
          created_at: string
          id: string
          is_active: boolean
          locality: string | null
          name: string
          note: string | null
          phone: string
          profession_other: string | null
          professions: string[]
          status: string
          submitted_by: string | null
          updated_at: string
          whatsapp: boolean
        }
        Insert: {
          business_listing_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          locality?: string | null
          name: string
          note?: string | null
          phone: string
          profession_other?: string | null
          professions: string[]
          status?: string
          submitted_by?: string | null
          updated_at?: string
          whatsapp?: boolean
        }
        Update: {
          business_listing_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          locality?: string | null
          name?: string
          note?: string | null
          phone?: string
          profession_other?: string | null
          professions?: string[]
          status?: string
          submitted_by?: string | null
          updated_at?: string
          whatsapp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "find_professionals_business_listing_id_fkey"
            columns: ["business_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      find_ratings: {
        Row: {
          comment: string
          created_at: string
          id: string
          professional_id: string
          rating: number
          status: string
          updated_at: string
          used_service: boolean
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          professional_id: string
          rating: number
          status?: string
          updated_at?: string
          used_service?: boolean
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          professional_id?: string
          rating?: number
          status?: string
          updated_at?: string
          used_service?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "find_ratings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "find_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string | null
          id: string
          thread_id: string | null
          upvotes: number | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string | null
          id?: string
          thread_id?: string | null
          upvotes?: number | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string | null
          id?: string
          thread_id?: string | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          approved: boolean | null
          author_id: string | null
          author_name: string | null
          body: string | null
          category: string
          category_slug: string
          created_at: string | null
          id: string
          last_activity_at: string | null
          pinned: boolean | null
          reply_count: number | null
          title: string
          upvotes: number | null
          view_count: number | null
        }
        Insert: {
          approved?: boolean | null
          author_id?: string | null
          author_name?: string | null
          body?: string | null
          category: string
          category_slug: string
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          pinned?: boolean | null
          reply_count?: number | null
          title: string
          upvotes?: number | null
          view_count?: number | null
        }
        Update: {
          approved?: boolean | null
          author_id?: string | null
          author_name?: string | null
          body?: string | null
          category?: string
          category_slug?: string
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          pinned?: boolean | null
          reply_count?: number | null
          title?: string
          upvotes?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_scores: {
        Row: {
          game: string
          id: string
          played_at: string
          score: number
          user_id: string
        }
        Insert: {
          game?: string
          id?: string
          played_at?: string
          score: number
          user_id: string
        }
        Update: {
          game?: string
          id?: string
          played_at?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          amount_paid: number | null
          approved: boolean | null
          category: string
          company: string
          contact_email: string | null
          contact_phone: string | null
          contact_phone_type: string | null
          coupon_used: string | null
          created_at: string | null
          description: string
          id: string
          location: string | null
          payment_id: string | null
          payment_status: string | null
          positions: number | null
          positions_filled: number | null
          posted_by: string | null
          requirements: string | null
          salary: string | null
          status: string | null
          title: string
          type: string
        }
        Insert: {
          amount_paid?: number | null
          approved?: boolean | null
          category: string
          company: string
          contact_email?: string | null
          contact_phone?: string | null
          contact_phone_type?: string | null
          coupon_used?: string | null
          created_at?: string | null
          description: string
          id?: string
          location?: string | null
          payment_id?: string | null
          payment_status?: string | null
          positions?: number | null
          positions_filled?: number | null
          posted_by?: string | null
          requirements?: string | null
          salary?: string | null
          status?: string | null
          title: string
          type?: string
        }
        Update: {
          amount_paid?: number | null
          approved?: boolean | null
          category?: string
          company?: string
          contact_email?: string | null
          contact_phone?: string | null
          contact_phone_type?: string | null
          coupon_used?: string | null
          created_at?: string | null
          description?: string
          id?: string
          location?: string | null
          payment_id?: string | null
          payment_status?: string | null
          positions?: number | null
          positions_filled?: number | null
          posted_by?: string | null
          requirements?: string | null
          salary?: string | null
          status?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      listing_delivery_config: {
        Row: {
          base_fee_paise: number
          delivery_enabled: boolean
          free_above_paise: number | null
          listing_id: string
          min_order_paise: number
          per_km_fee_paise: number
          prep_time_min: number
          radius_km: number
          updated_at: string
        }
        Insert: {
          base_fee_paise?: number
          delivery_enabled?: boolean
          free_above_paise?: number | null
          listing_id: string
          min_order_paise?: number
          per_km_fee_paise?: number
          prep_time_min?: number
          radius_km?: number
          updated_at?: string
        }
        Update: {
          base_fee_paise?: number
          delivery_enabled?: boolean
          free_above_paise?: number | null
          listing_id?: string
          min_order_paise?: number
          per_km_fee_paise?: number
          prep_time_min?: number
          radius_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_delivery_config_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_favourites: {
        Row: {
          created_at: string | null
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_favourites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_payment_configs: {
        Row: {
          created_at: string
          listing_id: string
          razorpay_key_id: string
          razorpay_key_last4: string
          razorpay_key_secret_encrypted: string
          test_mode: boolean
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          listing_id: string
          razorpay_key_id: string
          razorpay_key_last4: string
          razorpay_key_secret_encrypted: string
          test_mode?: boolean
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          listing_id?: string
          razorpay_key_id?: string
          razorpay_key_last4?: string
          razorpay_key_secret_encrypted?: string
          test_mode?: boolean
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_payment_configs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_thumb_url: string | null
          image_url: string | null
          is_active: boolean
          listing_id: string
          name: string
          price_paise: number
          quantity_in_stock: number | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_thumb_url?: string | null
          image_url?: string | null
          is_active?: boolean
          listing_id: string
          name: string
          price_paise: number
          quantity_in_stock?: number | null
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_thumb_url?: string | null
          image_url?: string | null
          is_active?: boolean
          listing_id?: string
          name?: string
          price_paise?: number
          quantity_in_stock?: number | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_products_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          created_at: string | null
          id: string
          listing_id: string
          question: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string | null
          id?: string
          listing_id: string
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string
          question?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_questions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_recommendations: {
        Row: {
          created_at: string | null
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_recommendations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string | null
          amount_paid: number | null
          appointment_booking_fee: number | null
          appointment_settings: Json | null
          appointments_enabled: boolean | null
          approved: boolean | null
          before_after: Json | null
          category: string
          certifications: Json | null
          coupon_used: string | null
          cover_image: string | null
          cover_image_thumb_url: string | null
          created_at: string | null
          delivery_info: Json | null
          description: string | null
          established_year: number | null
          expires_at: string | null
          facebook: string | null
          highlights: Json | null
          hours: string | null
          id: string
          image_thumb_url: string | null
          image_url: string | null
          instagram: string | null
          lat: number | null
          lng: number | null
          map_url: string | null
          name: string
          offer_expires_at: string | null
          offer_text: string | null
          owner_id: string | null
          payment_id: string | null
          payment_methods: Json | null
          payment_status: string | null
          payments_enabled: boolean | null
          phone: string | null
          photos: Json | null
          pinned_announcement: string | null
          plan: string | null
          rating: number | null
          reminders_sent: number[] | null
          response_time: string | null
          review_count: number | null
          services: Json | null
          subdomain: string | null
          tagline: string | null
          tags: Json | null
          updated_at: string | null
          upi_id: string | null
          verified: boolean | null
          video_url: string | null
          views: number | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          amount_paid?: number | null
          appointment_booking_fee?: number | null
          appointment_settings?: Json | null
          appointments_enabled?: boolean | null
          approved?: boolean | null
          before_after?: Json | null
          category: string
          certifications?: Json | null
          coupon_used?: string | null
          cover_image?: string | null
          cover_image_thumb_url?: string | null
          created_at?: string | null
          delivery_info?: Json | null
          description?: string | null
          established_year?: number | null
          expires_at?: string | null
          facebook?: string | null
          highlights?: Json | null
          hours?: string | null
          id?: string
          image_thumb_url?: string | null
          image_url?: string | null
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          map_url?: string | null
          name: string
          offer_expires_at?: string | null
          offer_text?: string | null
          owner_id?: string | null
          payment_id?: string | null
          payment_methods?: Json | null
          payment_status?: string | null
          payments_enabled?: boolean | null
          phone?: string | null
          photos?: Json | null
          pinned_announcement?: string | null
          plan?: string | null
          rating?: number | null
          reminders_sent?: number[] | null
          response_time?: string | null
          review_count?: number | null
          services?: Json | null
          subdomain?: string | null
          tagline?: string | null
          tags?: Json | null
          updated_at?: string | null
          upi_id?: string | null
          verified?: boolean | null
          video_url?: string | null
          views?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          amount_paid?: number | null
          appointment_booking_fee?: number | null
          appointment_settings?: Json | null
          appointments_enabled?: boolean | null
          approved?: boolean | null
          before_after?: Json | null
          category?: string
          certifications?: Json | null
          coupon_used?: string | null
          cover_image?: string | null
          cover_image_thumb_url?: string | null
          created_at?: string | null
          delivery_info?: Json | null
          description?: string | null
          established_year?: number | null
          expires_at?: string | null
          facebook?: string | null
          highlights?: Json | null
          hours?: string | null
          id?: string
          image_thumb_url?: string | null
          image_url?: string | null
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          map_url?: string | null
          name?: string
          offer_expires_at?: string | null
          offer_text?: string | null
          owner_id?: string | null
          payment_id?: string | null
          payment_methods?: Json | null
          payment_status?: string | null
          payments_enabled?: boolean | null
          phone?: string | null
          photos?: Json | null
          pinned_announcement?: string | null
          plan?: string | null
          rating?: number | null
          reminders_sent?: number[] | null
          response_time?: string | null
          review_count?: number | null
          services?: Json | null
          subdomain?: string | null
          tagline?: string | null
          tags?: Json | null
          updated_at?: string | null
          upi_id?: string | null
          verified?: boolean | null
          video_url?: string | null
          views?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          author_id: string | null
          category: string
          content: string | null
          created_at: string | null
          date: string | null
          excerpt: string | null
          featured: boolean | null
          id: string
          image: string | null
          published: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          author_id?: string | null
          category: string
          content?: string | null
          created_at?: string | null
          date?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          image?: string | null
          published?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          author_id?: string | null
          category?: string
          content?: string | null
          created_at?: string | null
          date?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          image?: string | null
          published?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          subscribed: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          subscribed?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          subscribed?: boolean | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          in_app_enabled: boolean
          muted_types: string[]
          telegram_chat_id: string | null
          telegram_enabled: boolean
          telegram_verified_at: string | null
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          email_enabled?: boolean
          in_app_enabled?: boolean
          muted_types?: string[]
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          telegram_verified_at?: string | null
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          email_enabled?: boolean
          in_app_enabled?: boolean
          muted_types?: string[]
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          telegram_verified_at?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          icon: string | null
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          icon?: string | null
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          icon?: string | null
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_total: number
          buyer_id: string | null
          buyer_name: string
          buyer_phone: string
          commission_amount: number
          commission_rate: number | null
          created_at: string | null
          delivery_address: string | null
          id: string
          listing_id: string | null
          notes: string | null
          owner_razorpay_order_id: string | null
          owner_razorpay_payment_id: string | null
          owner_razorpay_signature: string | null
          payment_flow: string
          payment_status: string | null
          payout_error: string | null
          payout_status: string | null
          product_id: string | null
          quantity: number | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_payout_id: string | null
          razorpay_signature: string | null
          seller_payout_amount: number
          seller_upi_id: string
          service_name: string
          service_price: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_total: number
          buyer_id?: string | null
          buyer_name: string
          buyer_phone: string
          commission_amount: number
          commission_rate?: number | null
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          listing_id?: string | null
          notes?: string | null
          owner_razorpay_order_id?: string | null
          owner_razorpay_payment_id?: string | null
          owner_razorpay_signature?: string | null
          payment_flow?: string
          payment_status?: string | null
          payout_error?: string | null
          payout_status?: string | null
          product_id?: string | null
          quantity?: number | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_payout_id?: string | null
          razorpay_signature?: string | null
          seller_payout_amount: number
          seller_upi_id: string
          service_name: string
          service_price: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_total?: number
          buyer_id?: string | null
          buyer_name?: string
          buyer_phone?: string
          commission_amount?: number
          commission_rate?: number | null
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          listing_id?: string | null
          notes?: string | null
          owner_razorpay_order_id?: string | null
          owner_razorpay_payment_id?: string | null
          owner_razorpay_signature?: string | null
          payment_flow?: string
          payment_status?: string | null
          payout_error?: string | null
          payout_status?: string | null
          product_id?: string | null
          quantity?: number | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_payout_id?: string | null
          razorpay_signature?: string | null
          seller_payout_amount?: number
          seller_upi_id?: string
          service_name?: string
          service_price?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "listing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_paise: number
          captured_at: string | null
          created_at: string
          currency: string
          entity_id: string | null
          entity_table: string | null
          finalized_at: string | null
          flow: string
          id: string
          last_error: string | null
          listing_id: string | null
          payload: Json
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          retry_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_table?: string | null
          finalized_at?: string | null
          flow: string
          id?: string
          last_error?: string | null
          listing_id?: string | null
          payload?: Json
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_table?: string | null
          finalized_at?: string | null
          flow?: string
          id?: string
          last_error?: string | null
          listing_id?: string | null
          payload?: Json
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          ends_at: string
          id: string
          options: Json
          title: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          id?: string
          options?: Json
          title: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          id?: string
          options?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          base_price: number
          current_price: number
          id: number
          job_base_price: number | null
          job_current_price: number | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          current_price?: number
          id?: number
          job_base_price?: number | null
          job_current_price?: number | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          current_price?: number
          id?: number
          job_base_price?: number | null
          job_current_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          name: string
          price: number
          seller_id: string | null
          unit: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name: string
          price: number
          seller_id?: string | null
          unit?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name?: string
          price?: number
          seller_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          phone: string | null
          role: string | null
          verified: boolean | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          phone?: string | null
          role?: string | null
          verified?: boolean | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          role?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          listing_id: string | null
          owner_replied_at: string | null
          owner_reply: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          owner_replied_at?: string | null
          owner_reply?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          owner_replied_at?: string | null
          owner_reply?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_assignments: {
        Row: {
          delivery_order_id: string
          id: string
          offered_at: string
          responded_at: string | null
          rider_id: string
          status: string
        }
        Insert: {
          delivery_order_id: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          rider_id: string
          status?: string
        }
        Update: {
          delivery_order_id?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          rider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_assignments_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_assignments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_earnings: {
        Row: {
          amount_paise: number
          created_at: string
          delivery_order_id: string | null
          id: string
          rider_id: string
          status: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          delivery_order_id?: string | null
          id?: string
          rider_id: string
          status?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          delivery_order_id?: string | null
          id?: string
          rider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_earnings_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_earnings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          created_at: string
          current_lat: number | null
          current_lng: number | null
          full_name: string
          home_business_id: string | null
          id: string
          is_online: boolean
          last_ping_at: string | null
          payout_upi: string | null
          phone: string
          rating: number | null
          status: string
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          full_name: string
          home_business_id?: string | null
          id?: string
          is_online?: boolean
          last_ping_at?: string | null
          payout_upi?: string | null
          phone: string
          rating?: number | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_type?: string
        }
        Update: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          full_name?: string
          home_business_id?: string | null
          id?: string
          is_online?: boolean
          last_ping_at?: string | null
          payout_upi?: string | null
          phone?: string
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "riders_home_business_id_fkey"
            columns: ["home_business_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          token: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_delivery_offer: {
        Args: { p_order_id: string; p_rider_id: string }
        Returns: boolean
      }
      create_appointment_booking: {
        Args: {
          p_booking_date: string
          p_booking_fee: number
          p_listing_id: string
          p_notes: string
          p_payment_status: string
          p_razorpay_order_id: string
          p_razorpay_payment_id: string
          p_razorpay_signature: string
          p_slot_end: string
          p_slot_start: string
          p_user_email: string
          p_user_id: string
          p_user_name: string
          p_user_phone: string
        }
        Returns: string
      }
      decrement_product_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: boolean
      }
      get_admin_find_counts: { Args: never; Returns: Json }
      get_game_leaderboard: {
        Args: { p_game: string; p_scope: string }
        Returns: Json
      }
      get_homepage_stats: { Args: never; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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

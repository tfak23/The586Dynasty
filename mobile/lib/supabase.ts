import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types (will be generated from Supabase schema)
export type Database = {
  public: {
    Tables: {
      leagues: {
        Row: {
          id: string;
          sleeper_league_id: string;
          name: string;
          salary_cap: number;
          min_contract_years: number;
          max_contract_years: number;
          trade_approval_mode: string;
          current_season: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['leagues']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['leagues']['Insert']>;
      };
      teams: {
        Row: {
          id: string;
          league_id: string;
          sleeper_roster_id: number;
          team_name: string;
          owner_name: string;
          avatar_url: string | null;
          division: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
      };
      contracts: {
        Row: {
          id: string;
          league_id: string;
          team_id: string;
          player_id: string;
          salary: number;
          years_total: number;
          years_remaining: number;
          start_season: number;
          end_season: number;
          contract_type: string;
          has_option: boolean;
          option_year: number | null;
          is_franchise_tagged: boolean;
          status: string;
          roster_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contracts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>;
      };
      players: {
        Row: {
          id: string;
          sleeper_player_id: string;
          full_name: string;
          position: string;
          team: string | null;
          age: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['players']['Insert']>;
      };
      trades: {
        Row: {
          id: string;
          league_id: string;
          status: string;
          approval_mode: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['trades']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};

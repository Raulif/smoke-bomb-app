export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          phone: string | null;
          lifetime_points: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          lifetime_points?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          lifetime_points?: number;
          created_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          total_points: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          total_points?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          total_points?: number;
          joined_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          group_id: string;
          started_by: string;
          status: 'active' | 'closed';
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          started_by: string;
          status?: 'active' | 'closed';
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          started_by?: string;
          status?: 'active' | 'closed';
          created_at?: string;
          closed_at?: string | null;
        };
      };
      smoke_bombs: {
        Row: {
          id: string;
          session_id: string;
          thrown_by: string;
          activated_at: string;
          arrived_home_at: string | null;
          status: 'active' | 'discovered' | 'escaped';
          victory_message: string | null;
          caught_message: string | null;
          points_earned: number | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          thrown_by: string;
          activated_at?: string;
          arrived_home_at?: string | null;
          status?: 'active' | 'discovered' | 'escaped';
          victory_message?: string | null;
          caught_message?: string | null;
          points_earned?: number | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          thrown_by?: string;
          activated_at?: string;
          arrived_home_at?: string | null;
          status?: 'active' | 'discovered' | 'escaped';
          victory_message?: string | null;
          caught_message?: string | null;
          points_earned?: number | null;
        };
      };
      accusations: {
        Row: {
          id: string;
          smoke_bomb_id: string;
          accused_by: string;
          accused_user_id: string;
          correct: boolean | null;
          accused_at: string;
          points_earned: number | null;
        };
        Insert: {
          id?: string;
          smoke_bomb_id: string;
          accused_by: string;
          accused_user_id: string;
          correct?: boolean | null;
          accused_at?: string;
          points_earned?: number | null;
        };
        Update: {
          id?: string;
          smoke_bomb_id?: string;
          accused_by?: string;
          accused_user_id?: string;
          correct?: boolean | null;
          accused_at?: string;
          points_earned?: number | null;
        };
      };
      badges: {
        Row: {
          id: string;
          user_id: string;
          badge_type: 'ghost' | 'phantom' | 'sprinter' | 'bloodhound' | 'detective' | 'founder' | 'legend';
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_type: 'ghost' | 'phantom' | 'sprinter' | 'bloodhound' | 'detective' | 'founder' | 'legend';
          earned_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          badge_type?: 'ghost' | 'phantom' | 'sprinter' | 'bloodhound' | 'detective' | 'founder' | 'legend';
          earned_at?: string;
        };
      };
    };
  };
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row'];
export type GroupRow = Database['public']['Tables']['groups']['Row'];
export type GroupMemberRow = Database['public']['Tables']['group_members']['Row'];
export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type SmokeBombRow = Database['public']['Tables']['smoke_bombs']['Row'];
export type AccusationRow = Database['public']['Tables']['accusations']['Row'];
export type BadgeRow = Database['public']['Tables']['badges']['Row'];
export type BadgeType = BadgeRow['badge_type'];

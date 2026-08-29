export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          total_games_played: number;
          total_wins: number;
          rating: number;
          is_guest: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          total_games_played?: number;
          total_wins?: number;
          rating?: number;
          is_guest?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          total_games_played?: number;
          total_wins?: number;
          rating?: number;
          is_guest?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          category: string;
          min_players: number;
          max_players: number;
          supports_spectators: boolean;
          is_available: boolean;
          thumbnail_url: string;
          created_at: string;
        };
        Insert: {
          id: string;
          slug: string;
          name: string;
          description: string;
          category: string;
          min_players: number;
          max_players: number;
          supports_spectators?: boolean;
          is_available?: boolean;
          thumbnail_url?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string;
          category?: string;
          min_players?: number;
          max_players?: number;
          supports_spectators?: boolean;
          is_available?: boolean;
          thumbnail_url?: string;
          created_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          name: string;
          host_id: string;
          game_id: string;
          status: string;
          is_private: boolean;
          max_players: number;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          host_id: string;
          game_id: string;
          status?: string;
          is_private?: boolean;
          max_players?: number;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          host_id?: string;
          game_id?: string;
          status?: string;
          is_private?: boolean;
          max_players?: number;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      room_players: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          role: string;
          is_ready: boolean;
          seat_index: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          role?: string;
          is_ready?: boolean;
          seat_index?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          role?: string;
          is_ready?: boolean;
          seat_index?: number;
          joined_at?: string;
        };
      };
      game_sessions: {
        Row: {
          id: string;
          room_id: string;
          game_id: string;
          status: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          game_id: string;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          game_id?: string;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
        };
      };
      game_results: {
        Row: {
          id: string;
          session_id: string;
          room_id: string;
          game_id: string;
          winner_id: string | null;
          scores: Json;
          duration_seconds: number;
          finish_reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          room_id: string;
          game_id: string;
          winner_id?: string | null;
          scores?: Json;
          duration_seconds: number;
          finish_reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          room_id?: string;
          game_id?: string;
          winner_id?: string | null;
          scores?: Json;
          duration_seconds?: number;
          finish_reason?: string;
          created_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_invites: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          room_id: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          room_id: string;
          status?: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          room_id?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          reason: string;
          details: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id: string;
          reason: string;
          details?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_user_id?: string;
          reason?: string;
          details?: string | null;
          status?: string;
          created_at?: string;
        };
      };
    };
  };
}

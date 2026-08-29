-- Playora: complete database setup.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to re-run: every statement is idempotent.


-- ============================================================
-- SOURCE: supabase/migrations/00001_initial_schema.sql
-- ============================================================

-- ==============================================================================
-- Migration: 00001_initial_schema.sql
-- Description: Game Platform Core Database Schema
-- Primary Keys: UUIDs, Foreign Keys, Indexes, RLS Policies, Triggers
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table (Users & Guests)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1200,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_rating ON public.profiles(rating DESC);

-- ------------------------------------------------------------------------------
-- 2. Games Catalog Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(32) NOT NULL, -- 'board', 'card', 'racing', 'casual'
  min_players INTEGER NOT NULL DEFAULT 2,
  max_players INTEGER NOT NULL DEFAULT 4,
  supports_spectators BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  thumbnail_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_slug ON public.games(slug);
CREATE INDEX IF NOT EXISTS idx_games_category ON public.games(category);

-- ------------------------------------------------------------------------------
-- 3. Multiplayer Rooms Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(12) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  status VARCHAR(24) NOT NULL DEFAULT 'waiting', -- 'waiting', 'starting', 'in_game', 'finished', 'abandoned'
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  max_players INTEGER NOT NULL DEFAULT 4,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON public.rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. Room Players Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'player', -- 'host', 'player', 'spectator'
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  seat_index INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON public.room_players(user_id);

-- ------------------------------------------------------------------------------
-- 5. Game Sessions Table (Lifecycle of matches)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  status VARCHAR(24) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'aborted'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room_id ON public.game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON public.game_sessions(status);

-- ------------------------------------------------------------------------------
-- 6. Game Results Table (Historical match summaries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scores JSONB NOT NULL DEFAULT '[]'::JSONB,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  finish_reason VARCHAR(32) NOT NULL DEFAULT 'normal', -- 'normal', 'resignation', 'timeout', 'disconnect', 'draw'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_results_session_id ON public.game_results(session_id);
CREATE INDEX IF NOT EXISTS idx_game_results_winner_id ON public.game_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON public.game_results(created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. Friendships Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_friendship_self CHECK (user_id != friend_id),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- ------------------------------------------------------------------------------
-- 8. Game Invites Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_invites_recipient ON public.game_invites(recipient_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_room_id ON public.game_invites(room_id);

-- ------------------------------------------------------------------------------
-- 9. Moderation Reports Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason VARCHAR(64) NOT NULL,
  details TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'open', -- 'open', 'reviewed', 'dismissed', 'action_taken'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Read policies (Public read for active platform games, public rooms, profiles)
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Available games are viewable by everyone" ON public.games FOR SELECT USING (is_available = true);
CREATE POLICY "Public rooms are viewable by everyone" ON public.rooms FOR SELECT USING (is_private = false OR auth.uid() = host_id);
CREATE POLICY "Room players viewable by participants" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Game results viewable by everyone" ON public.game_results FOR SELECT USING (true);

-- ============================================================
-- SOURCE: supabase/migrations/00002_auth_profile_bootstrap.sql
-- ============================================================

-- =============================================================================
-- Migration: 00002_auth_profile_bootstrap.sql
-- Links public.profiles to Supabase Auth and creates a profile automatically
-- for every new user, including anonymous (guest) sign-ins.
--
-- Spec section 12: a guest must receive a persistent identity and must be able
-- to link Google later WITHOUT losing profile, history, stats or achievements.
-- Supabase linkIdentity() keeps the same auth.users.id, so the profile row --
-- and everything foreign-keyed to it -- survives the upgrade untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tie profiles to auth.users
-- -----------------------------------------------------------------------------
-- The initial schema defaulted profiles.id to a fresh UUID, which would have
-- let profiles drift from real auth users. The id must BE the auth user id.
ALTER TABLE public.profiles ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 2. Profile creation on signup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_guest    BOOLEAN;
  v_display     TEXT;
  v_username    TEXT;
  v_base        TEXT;
  v_suffix      INTEGER := 0;
BEGIN
  v_is_guest := COALESCE(NEW.is_anonymous, FALSE);

  -- Prefer the OAuth-provided name, then the email local part, then a guest label.
  v_display := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'Guest ' || upper(substr(replace(NEW.id::TEXT, '-', ''), 1, 4))
  );

  -- username is UNIQUE NOT NULL: derive a slug, then disambiguate on collision.
  v_base := lower(regexp_replace(v_display, '[^a-zA-Z0-9_]', '', 'g'));
  IF length(v_base) < 3 THEN
    v_base := 'player';
  END IF;
  v_base := substr(v_base, 1, 24);
  v_username := v_base;

  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = v_username) LOOP
    v_suffix := v_suffix + 1;
    v_username := substr(v_base, 1, 24) || '_' || v_suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, is_guest)
  VALUES (
    NEW.id,
    v_username,
    v_display,
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    ),
    v_is_guest
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. Guest -> Google upgrade
-- -----------------------------------------------------------------------------
-- linkIdentity() updates auth.users in place rather than creating a new row, so
-- we only refresh the display fields and clear the guest flag. The id, and
-- therefore every rating, result and achievement referencing it, is unchanged.
CREATE OR REPLACE FUNCTION public.handle_user_upgraded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_anonymous, FALSE) = TRUE
     AND COALESCE(NEW.is_anonymous, FALSE) = FALSE THEN
    UPDATE public.profiles
    SET
      is_guest     = FALSE,
      display_name = COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
        display_name
      ),
      avatar_url   = COALESCE(
        NEW.raw_user_meta_data ->> 'avatar_url',
        NEW.raw_user_meta_data ->> 'picture',
        avatar_url
      ),
      updated_at   = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_upgraded ON auth.users;
CREATE TRIGGER on_auth_user_upgraded
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_upgraded();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security: a user may edit only their own profile
-- -----------------------------------------------------------------------------
-- 00001 granted SELECT only, so nobody could write. These add the missing
-- self-service policies without widening read access.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 5. Keep updated_at honest
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- SOURCE: supabase/migrations/00003_room_access_policies.sql
-- ============================================================

-- =============================================================================
-- Migration: 00003_room_access_policies.sql
-- Write policies for rooms and room_players.
--
-- 00001 enabled RLS and granted SELECT only, so every insert was silently
-- denied. These policies allow exactly the writes a player legitimately makes
-- on their own behalf, and nothing else.
--
-- game_sessions / game_results are deliberately NOT writable by clients: the
-- realtime Worker writes them with the service-role key, because match results
-- are decided by the server (spec sections 63, 83).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- rooms
-- -----------------------------------------------------------------------------
-- A user may create a room only with themselves as host, so host_id cannot be
-- forged by posting somebody else's id.
DROP POLICY IF EXISTS "Users can create rooms they host" ON public.rooms;
CREATE POLICY "Users can create rooms they host"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update their own rooms" ON public.rooms;
CREATE POLICY "Hosts can update their own rooms"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete their own rooms" ON public.rooms;
CREATE POLICY "Hosts can delete their own rooms"
  ON public.rooms FOR DELETE
  USING (auth.uid() = host_id);

-- Private rooms stay reachable by code, but are never listed. The existing
-- SELECT policy from 00001 already restricts listing to public rooms or the
-- host's own; joining by code goes through the server, which looks the room up
-- with the caller's session, so this policy must also admit seated players.
DROP POLICY IF EXISTS "Public rooms are viewable by everyone" ON public.rooms;
CREATE POLICY "Rooms are viewable by participants or when public"
  ON public.rooms FOR SELECT
  USING (
    is_private = false
    OR auth.uid() = host_id
    OR EXISTS (
      SELECT 1 FROM public.room_players rp
      WHERE rp.room_id = rooms.id AND rp.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- room_players
-- -----------------------------------------------------------------------------
-- A user may seat and unseat only themselves.
DROP POLICY IF EXISTS "Users can join rooms as themselves" ON public.room_players;
CREATE POLICY "Users can join rooms as themselves"
  ON public.room_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own seat" ON public.room_players;
CREATE POLICY "Users can update their own seat"
  ON public.room_players FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_players;
CREATE POLICY "Users can leave rooms"
  ON public.room_players FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_players.room_id AND r.host_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Indexes supporting the new access paths
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_public_waiting
  ON public.rooms (created_at DESC)
  WHERE is_private = false AND status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_room_players_lookup
  ON public.room_players (room_id, user_id);

-- ============================================================
-- SOURCE: supabase/migrations/00004_progression.sql
-- ============================================================

-- =============================================================================
-- Migration: 00004_progression.sql
-- Per-game ratings, rating history, platform XP and streaks.
--
-- These are three separate systems and must never be conflated
-- (spec sections 11, 104.6, 104.7):
--   * Platform level / XP  -> profiles.xp, profiles.level      (participation)
--   * Game rating          -> game_ratings.rating              (skill, per game)
--   * Competitive rank     -> derived from rating in code, not stored
--
-- 00001 gave profiles a single global `rating` column, which cannot express
-- "strong at chess, new to racing". It is retained but deprecated below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Platform progression on the profile
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_losses   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_draws    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.rating IS
  'DEPRECATED: a single global rating cannot represent per-game skill. Use game_ratings.';
COMMENT ON COLUMN public.profiles.xp IS
  'Platform XP. Participation, not skill -- see game_ratings for skill.';

CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC, xp DESC);

-- -----------------------------------------------------------------------------
-- 2. Per-game rating
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL DEFAULT 1200,
  peak_rating   INTEGER NOT NULL DEFAULT 1200,
  games_played  INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  draws         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_ratings_user ON public.game_ratings(user_id);
-- Supports the per-game leaderboard query directly.
CREATE INDEX IF NOT EXISTS idx_game_ratings_leaderboard
  ON public.game_ratings(game_id, rating DESC);

-- -----------------------------------------------------------------------------
-- 3. Rating history (drives the rating-over-time chart)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rating_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id        UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  session_id     UUID REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  rating_before  INTEGER NOT NULL,
  rating_after   INTEGER NOT NULL,
  delta          INTEGER NOT NULL,
  outcome        VARCHAR(8) NOT NULL, -- 'win' | 'loss' | 'draw'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rating_history_user_game
  ON public.rating_history(user_id, game_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
-- Ratings are public so leaderboards and player profiles work. Nothing here is
-- client-writable: progression is applied by the server after a match, from a
-- result the server decided (spec sections 63, 83).
ALTER TABLE public.game_ratings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Game ratings are publicly viewable" ON public.game_ratings;
CREATE POLICY "Game ratings are publicly viewable"
  ON public.game_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Rating history is viewable by its owner" ON public.rating_history;
CREATE POLICY "Rating history is viewable by its owner"
  ON public.rating_history FOR SELECT USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. Keep updated_at honest
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS game_ratings_touch_updated_at ON public.game_ratings;
CREATE TRIGGER game_ratings_touch_updated_at
  BEFORE UPDATE ON public.game_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Ensure a rating row exists before it is read
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_game_rating(p_user_id UUID, p_game_id UUID)
RETURNS public.game_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.game_ratings;
BEGIN
  INSERT INTO public.game_ratings (user_id, game_id)
  VALUES (p_user_id, p_game_id)
  ON CONFLICT (user_id, game_id) DO NOTHING;

  SELECT * INTO row
  FROM public.game_ratings
  WHERE user_id = p_user_id AND game_id = p_game_id;

  RETURN row;
END;
$$;

-- ============================================================
-- SOURCE: supabase/seed/seed.sql
-- ============================================================

-- ==============================================================================
-- Seed: seed.sql
-- Description: Game Catalog Seed Data
-- ==============================================================================

INSERT INTO public.games (id, slug, name, description, category, min_players, max_players, supports_spectators, is_available, thumbnail_url)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'chess',
    'Chess',
    'Classic 2-player strategic board game with real-time timers and move validation.',
    'board',
    2,
    2,
    true,
    true,
    '/thumbnails/chess.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'uno',
    'UNO Classic',
    'The classic fast-paced color and number matching card game for up to 4 players.',
    'card',
    2,
    4,
    true,
    true,
    '/thumbnails/uno.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'uno-no-mercy',
    'UNO No Mercy',
    'Brutal UNO edition with stacking penalties, wild roulette, and knockout rules.',
    'card',
    2,
    6,
    true,
    true,
    '/thumbnails/uno-no-mercy.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'car-race',
    'Car Race',
    'Top-down 2D arcade physics racing with high-speed drifting and nitro boosts.',
    'racing',
    2,
    8,
    true,
    true,
    '/thumbnails/car-race.png'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'bike-race',
    'Bike Race',
    'Precision balance and stunt motorcycle physics racing across challenging terrain.',
    'racing',
    2,
    8,
    true,
    true,
    '/thumbnails/bike-race.png'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  min_players = EXCLUDED.min_players,
  max_players = EXCLUDED.max_players,
  supports_spectators = EXCLUDED.supports_spectators,
  is_available = EXCLUDED.is_available,
  thumbnail_url = EXCLUDED.thumbnail_url;

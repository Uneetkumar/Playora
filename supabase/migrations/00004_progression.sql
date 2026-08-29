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

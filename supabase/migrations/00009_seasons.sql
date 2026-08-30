-- =============================================================================
-- Migration: 00009_seasons.sql
-- Competitive seasons (spec section 15).
--
-- The decision this migration settles: a season does NOT reset game_ratings.
-- Season standings live in their own rows, so the all-time per-game rating in
-- 00004 keeps its meaning ("how good is this player") while a season answers a
-- different question ("how are they doing right now"). Overwriting the first to
-- express the second would destroy the only long-run skill record we hold, and
-- it is not recoverable once done.
--
-- Nothing here is client-writable. Season standings are progression, and
-- progression is applied by the server from a result the server decided
-- (spec sections 63, 76, 83).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Seasons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  -- A short line for the season banner. Cosmetic.
  theme       VARCHAR(200),
  starts_at   TIMESTAMPTZ NOT NULL,
  -- Exclusive, so a season and its successor can share an edge with no gap in
  -- between where results would belong to no season at all.
  ends_at     TIMESTAMPTZ NOT NULL,
  -- When final standings were written. NULL means they have not been.
  --
  -- Deliberately a timestamp and not a status string: "this season is over"
  -- (a fact about the clock) and "its placements have been computed" (a fact
  -- about work the server has done) are different, and one status column would
  -- have to be wrong about one of them in the window between the two.
  closed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT seasons_span_is_forward CHECK (ends_at > starts_at)
);

-- Two overlapping seasons would make "the current season" ambiguous, and every
-- read here assumes it is not. The database refuses rather than trusting
-- whoever inserts the next season to check first.
ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_do_not_overlap;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_do_not_overlap
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&);

CREATE INDEX IF NOT EXISTS idx_seasons_span ON public.seasons(starts_at DESC, ends_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Per-season, per-game standing
-- -----------------------------------------------------------------------------
-- Mirrors game_ratings, scoped to one season. games_played restarts at zero on
-- purpose: a fresh season makes everyone provisional again (K=40), which is
-- what lets a soft-reset ladder re-sort itself quickly.
CREATE TABLE IF NOT EXISTS public.season_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
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
  UNIQUE (season_id, user_id, game_id)
);

-- Serves the season leaderboard read directly.
CREATE INDEX IF NOT EXISTS idx_season_ratings_board
  ON public.season_ratings(season_id, game_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_season_ratings_user
  ON public.season_ratings(user_id, season_id);

DROP TRIGGER IF EXISTS season_ratings_touch_updated_at ON public.season_ratings;
CREATE TRIGGER season_ratings_touch_updated_at
  BEFORE UPDATE ON public.season_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Final standings
-- -----------------------------------------------------------------------------
-- Written once when a season closes. This is the permanent record: season_ratings
-- could in principle be recomputed, but a player's finishing position is a claim
-- the platform made to them, and it must not silently change afterwards.
--
-- There is no reward-tier column. The tier is a pure function of (rank,
-- total_ranked) in packages/progression, which is tested; storing it as well
-- would create a second implementation of the band boundaries that could drift
-- from the first.
CREATE TABLE IF NOT EXISTS public.season_placements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  rank          INTEGER NOT NULL,
  -- The population the rank was out of, captured at close time so the
  -- percentile can be recomputed later without re-deriving who qualified.
  total_ranked  INTEGER NOT NULL,
  rating        INTEGER NOT NULL,
  games_played  INTEGER NOT NULL,
  wins          INTEGER NOT NULL,
  losses        INTEGER NOT NULL,
  draws         INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_season_placements_user
  ON public.season_placements(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_season_placements_board
  ON public.season_placements(season_id, game_id, rank);

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
-- Read-only to everyone, writable by nobody holding a user token. Seasons and
-- standings are public because leaderboards and profiles show them; the absence
-- of any INSERT/UPDATE/DELETE policy is what stops a player editing their own
-- placement, and it is deliberate rather than an omission.
ALTER TABLE public.seasons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_placements  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seasons are publicly viewable" ON public.seasons;
CREATE POLICY "Seasons are publicly viewable"
  ON public.seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Season ratings are publicly viewable" ON public.season_ratings;
CREATE POLICY "Season ratings are publicly viewable"
  ON public.season_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Season placements are publicly viewable" ON public.season_placements;
CREATE POLICY "Season placements are publicly viewable"
  ON public.season_placements FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- 5. Closing a season
-- -----------------------------------------------------------------------------
-- Snapshots final standings and stamps closed_at. Idempotent: calling it twice
-- is a no-op, because a season that already has a closed_at returns 0 without
-- touching anything. That matters because whatever triggers this -- a cron, an
-- admin button, a retried queue message -- can and will fire more than once.
--
-- SECURITY DEFINER so it can write tables that have no write policy, and then
-- immediately revoked from every client role below: only the service role may
-- call it. A SECURITY DEFINER function left executable by `authenticated` is a
-- hole straight through RLS.
CREATE OR REPLACE FUNCTION public.close_season(p_season_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season public.seasons;
  v_written INTEGER := 0;
BEGIN
  SELECT * INTO v_season FROM public.seasons WHERE id = p_season_id FOR UPDATE;

  IF v_season.id IS NULL THEN
    RAISE EXCEPTION 'No such season: %', p_season_id;
  END IF;

  IF v_season.closed_at IS NOT NULL THEN
    RETURN 0;  -- Already closed. Standings must not be rewritten.
  END IF;

  IF NOW() < v_season.ends_at THEN
    RAISE EXCEPTION 'Season % has not ended yet', v_season.slug;
  END IF;

  -- Rank within each game separately: rating is per game, so there is no single
  -- cross-game standing to compute. Only players who met the minimum are
  -- ranked, and the tie-break is games played then the earliest to arrive, so
  -- the order is total and stable rather than arbitrary.
  WITH ranked AS (
    SELECT
      sr.user_id,
      sr.game_id,
      sr.rating,
      sr.games_played,
      sr.wins,
      sr.losses,
      sr.draws,
      ROW_NUMBER() OVER (
        PARTITION BY sr.game_id
        ORDER BY sr.rating DESC, sr.games_played DESC, sr.created_at ASC
      ) AS rank,
      COUNT(*) OVER (PARTITION BY sr.game_id) AS total_ranked
    FROM public.season_ratings sr
    WHERE sr.season_id = p_season_id
      AND sr.games_played >= 10  -- keep in step with SEASON_PLACEMENT_GAMES
  )
  INSERT INTO public.season_placements
    (season_id, user_id, game_id, rank, total_ranked, rating, games_played, wins, losses, draws)
  SELECT p_season_id, user_id, game_id, rank, total_ranked, rating, games_played, wins, losses, draws
  FROM ranked
  ON CONFLICT (season_id, user_id, game_id) DO NOTHING;

  GET DIAGNOSTICS v_written = ROW_COUNT;

  UPDATE public.seasons SET closed_at = NOW() WHERE id = p_season_id;

  RETURN v_written;
END;
$$;

REVOKE ALL ON FUNCTION public.close_season(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_season(UUID) FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. The first season
-- -----------------------------------------------------------------------------
-- Without a row here the platform has no active season and every season read
-- returns nothing, which looks identical to a bug.
INSERT INTO public.seasons (slug, name, theme, starts_at, ends_at)
VALUES (
  'season-1',
  'Season One',
  'The first competitive season on Playora.',
  DATE_TRUNC('day', NOW()),
  DATE_TRUNC('day', NOW()) + INTERVAL '90 days'
)
ON CONFLICT (slug) DO NOTHING;

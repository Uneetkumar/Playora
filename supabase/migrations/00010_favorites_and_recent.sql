-- -----------------------------------------------------------------------------
-- 00010 — Favourites, recently played, and per-game saves
--
-- Three tables the discovery surface needs and the schema did not have. All
-- three are keyed (user_id, game_slug) rather than stored as arrays on
-- `profiles`: a favourites array is one row that every write contends on, it
-- cannot be indexed usefully, and it grows without bound on the hottest row in
-- the database.
--
-- `game_slug` is TEXT rather than a foreign key to `games`. The catalog is
-- still authored in TypeScript (see docs/PLAYORA_ARCHITECTURE.md, F4), so a
-- foreign key would break the moment a game ships in code before its row
-- exists. Phase 5 moves the catalog into the database; the constraint belongs
-- with that change, not ahead of it.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Favourites
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_slug  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_slug)
);

-- The only query: "my favourites, newest first".
CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON public.favorites(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Recently played
--
-- One row per (user, game), updated on each play rather than appended — the
-- question is "what was I playing", not "every session I ever started", and
-- `game_results` already holds the latter as an audit trail.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recently_played (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_slug    TEXT NOT NULL,
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A convenience counter for "you have played this 12 times".
  --
  -- Client-writable, and therefore NOT TRUSTWORTHY. Nothing that awards
  -- anything may read it: achievements, rating and progression all count from
  -- `game_results`, which only the Worker can write. Left here deliberately
  -- rather than routed through the server, because a round trip on every game
  -- start is a real cost for a number that decorates a card.
  play_count   INTEGER NOT NULL DEFAULT 1 CHECK (play_count >= 0),
  PRIMARY KEY (user_id, game_slug)
);

CREATE INDEX IF NOT EXISTS idx_recently_played_user
  ON public.recently_played(user_id, last_played_at DESC);

-- -----------------------------------------------------------------------------
-- Per-game saves
--
-- Opaque JSON, because what a game needs to resume is the game's business.
-- Capped so a client cannot use the row as free storage.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_progress (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_slug  TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_slug),
  CONSTRAINT game_progress_size CHECK (pg_column_size(data) <= 16384)
);

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- All three are private to their owner: unlike achievements, which are public
-- so they can appear on a profile, nobody else has any business reading what
-- you favourited or where you left off. Every policy is scoped to
-- `auth.uid() = user_id` for both the row being read and the row being written
-- — a WITH CHECK is what stops a client inserting a row under someone else's
-- id, and its absence is exactly the mistake migration 00007 was written to
-- fix on `friendships`.
-- -----------------------------------------------------------------------------

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own favourites" ON public.favorites;
CREATE POLICY "Users read their own favourites"
  ON public.favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add their own favourites" ON public.favorites;
CREATE POLICY "Users add their own favourites"
  ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove their own favourites" ON public.favorites;
CREATE POLICY "Users remove their own favourites"
  ON public.favorites FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own history" ON public.recently_played;
CREATE POLICY "Users read their own history"
  ON public.recently_played FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users record their own plays" ON public.recently_played;
CREATE POLICY "Users record their own plays"
  ON public.recently_played FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own plays" ON public.recently_played;
CREATE POLICY "Users update their own plays"
  ON public.recently_played FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users clear their own history" ON public.recently_played;
CREATE POLICY "Users clear their own history"
  ON public.recently_played FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own saves" ON public.game_progress;
CREATE POLICY "Users read their own saves"
  ON public.game_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users write their own saves" ON public.game_progress;
CREATE POLICY "Users write their own saves"
  ON public.game_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users replace their own saves" ON public.game_progress;
CREATE POLICY "Users replace their own saves"
  ON public.game_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete their own saves" ON public.game_progress;
CREATE POLICY "Users delete their own saves"
  ON public.game_progress FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Recording a play, atomically.
--
-- The obvious client-side version — read the count, add one, write it back —
-- loses plays whenever two tabs do it at once, and needs two round trips. This
-- is one statement, and `SECURITY INVOKER` keeps it behind the same RLS
-- policies as a direct write, so it grants nothing the caller did not have.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_play(p_game_slug TEXT)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.recently_played (user_id, game_slug, last_played_at, play_count)
  VALUES (auth.uid(), p_game_slug, NOW(), 1)
  ON CONFLICT (user_id, game_slug) DO UPDATE
    SET last_played_at = NOW(),
        play_count = public.recently_played.play_count + 1;
$$;

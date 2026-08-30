-- -----------------------------------------------------------------------------
-- 00006 — Achievements
--
-- Only the *unlocks* are stored. The catalogue itself lives in
-- packages/progression/src/achievements.ts, because an achievement is a rule
-- plus some copy, and a rule belongs in code where it can be tested. Keeping a
-- mirror of it in Postgres would mean two sources of truth that drift.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id VARCHAR(64) NOT NULL,
  session_id     UUID REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON public.user_achievements(user_id, unlocked_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Achievements are public so they can appear on a profile. Nothing here is
-- client-writable: they are awarded by the Worker with the service-role key
-- from a match the server decided (spec sections 63, 83). A client that could
-- insert here could award itself anything.
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Achievements are publicly viewable" ON public.user_achievements;
CREATE POLICY "Achievements are publicly viewable"
  ON public.user_achievements FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- 00005 — Match history
--
-- Participants live inside game_results.scores as JSONB, which is the right
-- shape (a result is one row) but the wrong thing to filter on without an
-- index: "my matches" was being answered by fetching the newest 40 results on
-- the whole platform and filtering them in the browser, which stops returning
-- anything as soon as more than 40 matches are played between visits.
--
-- A GIN index makes `scores @> '[{"userId": "..."}]'` an index scan, so the
-- filter can move to the server where it belongs.
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_game_results_scores_gin
  ON public.game_results USING GIN (scores jsonb_path_ops);

-- Match history is always read newest-first for one game at a time on the
-- filtered views, so keep that ordering cheap.
CREATE INDEX IF NOT EXISTS idx_game_results_game_created
  ON public.game_results(game_id, created_at DESC);

-- rating_history is joined to a result by session; the existing index is on
-- (user_id, game_id, created_at), which does not serve a lookup by session.
CREATE INDEX IF NOT EXISTS idx_rating_history_session
  ON public.rating_history(session_id);

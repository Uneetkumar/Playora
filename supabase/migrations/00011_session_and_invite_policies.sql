-- -----------------------------------------------------------------------------
-- 00011 — Policies for game_sessions and game_invites
--
-- Both tables have had `ENABLE ROW LEVEL SECURITY` since 00001 and no policies
-- at all. That denies every read and every write to every client, silently:
-- there is no error, the query simply returns nothing.
--
-- This is the same mistake migration 00007 fixed on `friendships`, and it went
-- unnoticed for the same reason — an empty result looks like "no data yet"
-- rather than "permission denied". It was found by a test that reads the
-- migrations as text and asserts every RLS-enabled table has a policy
-- (`apps/web/src/lib/__tests__/migration-rls.test.ts`).
--
-- Observed impact: the admin dashboard counts sessions with
-- `supabase.from("game_sessions").select("id", { count: "exact", head: true })`
-- (`use-admin-metrics.ts`), which has therefore always returned zero for every
-- viewer including admins. `game_invites` has no browser reader yet, so the
-- damage there was latent rather than visible.
--
-- The Worker is unaffected either way: it holds the service-role key, which
-- bypasses RLS entirely. That is also why every write path kept working and
-- nothing failed loudly.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- game_sessions
--
-- A session is the record of a match in a room. `game_results` is already
-- world-readable (00001) because match history and leaderboards are public, and
-- a session carries strictly less than its result — so the same visibility is
-- consistent rather than a widening.
--
-- Writes stay closed. Sessions are created and closed by the Worker from a
-- match the server ran; a client that could insert here could invent matches,
-- and the rating and achievement pipelines both read from this chain.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Game sessions viewable by everyone" ON public.game_sessions;
CREATE POLICY "Game sessions viewable by everyone"
  ON public.game_sessions FOR SELECT USING (true);

-- -----------------------------------------------------------------------------
-- game_invites
--
-- An invite is addressed to one person, so unlike a session it is private to
-- the two parties. Either side may read it; only the sender may create one, and
-- only the recipient may answer it — which is what stops someone accepting an
-- invitation that was never extended to them.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Invites viewable by either party" ON public.game_invites;
CREATE POLICY "Invites viewable by either party"
  ON public.game_invites FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users send their own invites" ON public.game_invites;
CREATE POLICY "Users send their own invites"
  ON public.game_invites FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients answer their invites" ON public.game_invites;
CREATE POLICY "Recipients answer their invites"
  ON public.game_invites FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Senders withdraw their invites" ON public.game_invites;
CREATE POLICY "Senders withdraw their invites"
  ON public.game_invites FOR DELETE
  USING (auth.uid() = sender_id);

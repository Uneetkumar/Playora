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

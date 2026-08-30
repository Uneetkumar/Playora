-- -----------------------------------------------------------------------------
-- 00007 — Friendship access policies
--
-- `friendships` had RLS enabled in 00001 and no policies written for it. With
-- RLS on and no policy, Postgres denies everything: every read returned zero
-- rows and every insert failed. The friends page looked "empty" rather than
-- broken, which is how it survived this long.
--
-- The shape of the rules is asymmetric on purpose. Anyone may *ask*; only the
-- person who was asked may accept.
-- -----------------------------------------------------------------------------

-- Read: you can see a friendship only if you are one of its two sides.
DROP POLICY IF EXISTS "Friendships viewable by either side" ON public.friendships;
CREATE POLICY "Friendships viewable by either side"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Send a request: only ever as yourself, and only as pending. Without the
-- status check a client could insert a row that is already 'accepted' and add
-- itself to someone else's friends list.
DROP POLICY IF EXISTS "Users can send their own friend requests" ON public.friendships;
CREATE POLICY "Users can send their own friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Respond: the recipient accepts or blocks. The sender cannot accept on the
-- recipient's behalf, which is the whole point of a request.
DROP POLICY IF EXISTS "Recipients can respond to friend requests" ON public.friendships;
CREATE POLICY "Recipients can respond to friend requests"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = friend_id)
  WITH CHECK (auth.uid() = friend_id AND status IN ('accepted', 'blocked'));

-- Either side can walk away: the sender withdrawing, the recipient declining,
-- or either of them unfriending later.
DROP POLICY IF EXISTS "Either side can remove a friendship" ON public.friendships;
CREATE POLICY "Either side can remove a friendship"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Finding someone to add means searching by username.
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles(LOWER(username));

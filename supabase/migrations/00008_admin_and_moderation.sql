-- -----------------------------------------------------------------------------
-- 00008 — Staff roles, moderation and audit
--
-- Moderation is mandatory because live chat and voice exist (spec v2 §77).
--
-- THE IMPORTANT DECISION: roles do NOT live on `profiles`.
--
-- Migration 00002 lets a user update their own profile row:
--
--     CREATE POLICY ... ON public.profiles FOR UPDATE
--       USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
--
-- A `role` column there would therefore be writable by its own subject, and any
-- player could make themselves an administrator with a single PostgREST call.
-- Roles live in their own table with no client-writable policy at all — they
-- are granted with the service role, out of band.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       VARCHAR(16) NOT NULL CHECK (role IN ('moderator', 'admin')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- is_staff()
--
-- SECURITY DEFINER so it can read user_roles regardless of the caller's own
-- policies, and with a pinned search_path so a caller cannot shadow
-- `user_roles` with a table of their own and answer the question themselves.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- A person may see their own role, and staff may see everyone's. Nobody may
-- write: there is deliberately no INSERT, UPDATE or DELETE policy, so the only
-- way to grant a role is with the service key.
DROP POLICY IF EXISTS "Users see their own role" ON public.user_roles;
CREATE POLICY "Users see their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff());

-- -----------------------------------------------------------------------------
-- Reports
--
-- `reports` was created in 00001 with RLS enabled and no policies at all, which
-- denies everything: nobody could file a report and nobody could read one. The
-- same latent bug friendships had.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users file their own reports" ON public.reports;
CREATE POLICY "Users file their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id AND auth.uid() <> reported_user_id);

DROP POLICY IF EXISTS "Reporters and staff read reports" ON public.reports;
CREATE POLICY "Reporters and staff read reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_staff());

-- Only staff resolve a report. A reporter cannot mark their own report actioned.
DROP POLICY IF EXISTS "Staff resolve reports" ON public.reports;
CREATE POLICY "Staff resolve reports"
  ON public.reports FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- Blocks
--
-- Personal, and not moderation: blocking is one player deciding not to see
-- another. Nobody but the blocker can read the list — who you have blocked is
-- not information the blocked person is entitled to.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_block_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Blockers manage their own blocks" ON public.blocks;
CREATE POLICY "Blockers manage their own blocks"
  ON public.blocks FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- -----------------------------------------------------------------------------
-- Moderation actions
--
-- The audit trail, and the reason this table exists at all: a moderation system
-- whose decisions cannot be reviewed is indistinguishable from an arbitrary
-- one. Append-only from the client's perspective — there is no UPDATE or DELETE
-- policy, so a moderator cannot quietly edit what they did.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      VARCHAR(16) NOT NULL CHECK (action IN ('warn', 'mute', 'suspend', 'ban', 'unban')),
  reason      TEXT NOT NULL,
  report_id   UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  -- Null for a permanent action.
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_target ON public.moderation_actions(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_created ON public.moderation_actions(created_at DESC);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read the audit trail" ON public.moderation_actions;
CREATE POLICY "Staff read the audit trail"
  ON public.moderation_actions FOR SELECT
  USING (public.is_staff() OR auth.uid() = target_id);

-- The actor must be the person taking the action: a moderator cannot record a
-- decision under someone else's name.
DROP POLICY IF EXISTS "Staff record their own actions" ON public.moderation_actions;
CREATE POLICY "Staff record their own actions"
  ON public.moderation_actions FOR INSERT
  WITH CHECK (public.is_staff() AND auth.uid() = actor_id);

-- -----------------------------------------------------------------------------
-- Current standing
--
-- Derived from the audit trail rather than stored as a flag on the profile,
-- so "why is this person muted" always has an answer.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.active_sanctions AS
SELECT DISTINCT ON (target_id, action)
  target_id,
  action,
  reason,
  expires_at,
  created_at
FROM public.moderation_actions
WHERE action IN ('mute', 'suspend', 'ban')
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY target_id, action, created_at DESC;

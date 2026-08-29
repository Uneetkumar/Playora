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

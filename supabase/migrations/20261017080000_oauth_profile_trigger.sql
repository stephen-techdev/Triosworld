/*
# Auto-create a profile row for Google OAuth users

## Problem
The mobile + password flow creates the `profiles` row itself (the edge function
inserts it right after creating the Auth user). Google OAuth users, however, are
created directly by Supabase Auth, so they had no profile row — which made the
app treat them as signed out and bounce them between /account and /login.

## Fix
An `AFTER INSERT` trigger on `auth.users` creates the matching `profiles` row for
any Auth user that has no phone number (i.e. OAuth users). Phone-based signups are
left alone because the edge function inserts their profile row atomically with the
bcrypt password hash.

The function is `SECURITY DEFINER` so it can insert into `profiles` regardless of
RLS (RLS on `profiles` intentionally has no INSERT policy for clients).

## Notes
- `google_id` is taken from the OAuth subject (`sub`) and is unique when present,
  so the same Google account can never map to two customer rows.
- Name/avatar fall back through the metadata Supabase stores for Google logins.
*/

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL THEN
    INSERT INTO public.profiles (id, mobile, full_name, gender, avatar_url, google_id, password_hash)
    VALUES (
      NEW.id,
      NULL,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1),
        'TriosWorld Customer'
      ),
      NULL,
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      NEW.raw_user_meta_data->>'sub',
      NULL
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- One customer row per Google account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_id
  ON profiles (google_id)
  WHERE google_id IS NOT NULL;

-- Backfill: any OAuth user created before this trigger existed still needs a row.
INSERT INTO profiles (id, mobile, full_name, avatar_url, google_id)
SELECT
  u.id,
  NULL,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'TriosWorld Customer'),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  u.raw_user_meta_data->>'sub'
FROM auth.users u
WHERE u.phone IS NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

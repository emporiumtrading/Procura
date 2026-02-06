-- =====================================================
-- Fix User Creation & Profiles (IDEMPOTENT VERSION)
-- Run this in Supabase SQL Editor if you encounter "Database error saving new user"
-- =====================================================

-- 1. Make the trigger function robust (uses ON CONFLICT for idempotency)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer'::user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-create the trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Add fallback Insert policy (if not already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- 4. Grant permissions to ensure the trigger works
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

-- 5. Manually fix any existing users who have no profile
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 
  'viewer'::user_role
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 6. Verification query (run to check if fix worked)
-- SELECT 
--   COUNT(DISTINCT au.id) as total_auth_users,
--   COUNT(DISTINCT p.id) as total_profiles,
--   COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as missing_profiles
-- FROM auth.users au
-- LEFT JOIN public.profiles p ON p.id = au.id;

-- =====================================================
-- Comprehensive Fix for User Signup Issues
-- This migration diagnoses and fixes all potential signup problems
-- =====================================================

-- 1. Ensure user_role enum type exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');
        RAISE NOTICE 'Created user_role enum type';
    ELSE
        RAISE NOTICE 'user_role enum type already exists';
    END IF;
END $$;

-- 2. Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
RAISE NOTICE 'Dropped existing trigger';

-- 3. Create robust trigger function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_full_name TEXT;
BEGIN
    -- Extract full name from metadata or use email prefix
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- Insert into profiles with explicit type casting and error handling
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        created_at,
        last_active
    )
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        'viewer'::user_role,  -- Explicit cast to enum type
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        last_active = NOW();

    RAISE NOTICE 'Successfully created/updated profile for user %', NEW.email;
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: % %', NEW.email, SQLERRM, SQLSTATE;
    -- Still return NEW to allow auth.users insert to succeed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

RAISE NOTICE 'Created new trigger on auth.users';

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

RAISE NOTICE 'Granted necessary permissions';

-- 6. Ensure RLS policies exist
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Service role has full access"
    ON public.profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

RAISE NOTICE 'Created RLS policies';

-- 7. Backfill any existing auth users without profiles
INSERT INTO public.profiles (id, email, full_name, role, created_at, last_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'viewer'::user_role,
    au.created_at,
    NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE 'Backfilled existing users';

-- 8. Verification query
DO $$
DECLARE
    auth_count INTEGER;
    profile_count INTEGER;
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    missing_count := auth_count - profile_count;

    RAISE NOTICE 'Verification: % auth users, % profiles, % missing',
        auth_count, profile_count, missing_count;

    IF missing_count > 0 THEN
        RAISE WARNING 'There are still % users without profiles!', missing_count;
    ELSE
        RAISE NOTICE 'All auth users have profiles. Setup complete!';
    END IF;
END $$;

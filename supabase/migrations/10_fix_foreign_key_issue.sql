-- =====================================================
-- PRODUCTION FIX: Foreign Key Constraint Issue
-- Permanent solution for profiles_id_fkey blocking trigger
-- =====================================================

-- Step 1: Drop and recreate the foreign key constraint as DEFERRABLE
-- This allows the transaction to validate the constraint at commit time
-- instead of immediately during the trigger execution

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Recreate as DEFERRABLE INITIALLY DEFERRED
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- Step 2: Ensure trigger uses SECURITY DEFINER with correct search path
-- This ensures the trigger has the right permissions to insert

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Critical: Set search path to avoid any schema issues
SET search_path = public, auth
AS $$
BEGIN
    -- Insert with all necessary fields
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at,
        last_active
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'viewer',  -- Use string literal, will be auto-cast to user_role
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW(),
        last_active = NOW();

    RETURN NEW;
END;
$$;

-- Step 3: Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Ensure correct permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 5: Verify the user_role enum has correct values
-- First check what values exist
DO $$
DECLARE
    enum_values text[];
BEGIN
    SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
    INTO enum_values
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role';

    RAISE NOTICE 'Current user_role values: %', enum_values;

    -- Add 'viewer' if it doesn't exist (it should based on original schema)
    IF NOT ('viewer' = ANY(enum_values)) THEN
        ALTER TYPE user_role ADD VALUE 'viewer';
        RAISE NOTICE 'Added viewer to user_role enum';
    END IF;
END $$;

-- Step 6: Update RLS policies to work with service_role
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;

-- Recreate policies
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Critical: Service role needs full access for trigger to work
CREATE POLICY "Service role has full access"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Step 7: Grant auth.users read access to service_role (needed for FK check)
GRANT SELECT ON TABLE auth.users TO service_role;

-- Step 8: Backfill any missing profiles
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at, last_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'viewer',
    COALESCE(au.created_at, NOW()),
    NOW(),
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

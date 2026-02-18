-- =====================================================
-- Diagnostic Script for Signup Issues
-- Run this in Supabase SQL Editor to identify the problem
-- =====================================================

-- Check 1: Does user_role enum exist?
SELECT
    'user_role enum exists' as check_name,
    EXISTS(SELECT 1 FROM pg_type WHERE typname = 'user_role') as result;

-- Check 2: What are the enum values?
SELECT
    'user_role enum values' as check_name,
    enumlabel as value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role';

-- Check 3: Does the profiles table exist and what's its structure?
SELECT
    'profiles table columns' as check_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check 4: Does the trigger exist?
SELECT
    'trigger exists' as check_name,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
    AND event_object_table = 'users'
    AND trigger_name = 'on_auth_user_created';

-- Check 5: What's the current trigger function code?
SELECT
    'trigger function code' as check_name,
    prosrc as function_body
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user';

-- Check 6: What RLS policies exist on profiles?
SELECT
    'profiles RLS policies' as check_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check 7: Test if we can manually insert a profile
-- (This will fail but show us the exact error)
DO $$
BEGIN
    -- Try to insert a test profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'test@example.com',
        'Test User',
        'viewer'::user_role
    );
    RAISE NOTICE 'Test insert succeeded!';

    -- Clean up
    DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000';
    RAISE NOTICE 'Test cleanup succeeded!';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test insert failed with error: % - %', SQLERRM, SQLSTATE;
END $$;

-- Check 8: Count auth users vs profiles
SELECT
    (SELECT COUNT(*) FROM auth.users) as auth_users_count,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    (SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM public.profiles) as missing_profiles;

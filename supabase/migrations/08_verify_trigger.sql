-- =====================================================
-- Verification Script - Test Trigger Functionality
-- Run this AFTER applying 07_fix_trigger_production.sql
-- =====================================================

-- Test 1: Verify user_role enum exists and has correct values
SELECT 'Test 1: user_role enum' as test_name, enumlabel as value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'
ORDER BY enumsortorder;

-- Test 2: Verify trigger exists
SELECT
    'Test 2: Trigger exists' as test_name,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
    AND trigger_name = 'on_auth_user_created';

-- Test 3: Verify trigger function exists and is correct
SELECT
    'Test 3: Trigger function' as test_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user';

-- Test 4: Verify RLS policies
SELECT
    'Test 4: RLS Policies' as test_name,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'profiles'
ORDER BY policyname;

-- Test 5: Verify permissions on profiles table
SELECT
    'Test 5: Table permissions' as test_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
    AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- Test 6: Test manual profile insert (simulates what trigger does)
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
    test_email text := 'test-' || gen_random_uuid()::text || '@example.com';
BEGIN
    -- Try inserting a profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (test_id, test_email, 'Test User', 'viewer'::user_role);

    RAISE NOTICE 'SUCCESS: Manual profile insert works correctly';

    -- Clean up test data
    DELETE FROM public.profiles WHERE id = test_id;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAILED: Manual profile insert failed - % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Test 7: Verify all existing users have profiles
SELECT
    'Test 7: User-Profile mapping' as test_name,
    COUNT(DISTINCT au.id) as total_users,
    COUNT(DISTINCT p.id) as total_profiles,
    COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as missing_profiles
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;

-- Test 8: Check for any orphaned profiles
SELECT
    'Test 8: Orphaned profiles' as test_name,
    COUNT(*) as orphaned_count
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE au.id IS NULL;

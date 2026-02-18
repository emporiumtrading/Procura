-- =====================================================
-- Final Verification - Test Complete Fix
-- =====================================================

-- Test 1: Check foreign key constraint is now DEFERRABLE
SELECT
    'Test 1: Foreign Key is DEFERRABLE' as test_name,
    tc.constraint_name,
    rc.delete_rule,
    CASE
        WHEN con.condeferrable THEN 'DEFERRABLE ✓'
        ELSE 'NOT DEFERRABLE ✗'
    END as is_deferrable,
    CASE
        WHEN con.condeferred THEN 'INITIALLY DEFERRED ✓'
        ELSE 'INITIALLY IMMEDIATE'
    END as defer_mode
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
JOIN pg_constraint con
    ON con.conname = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'profiles'
    AND tc.table_schema = 'public'
    AND tc.constraint_name = 'profiles_id_fkey';

-- Test 2: Verify trigger function exists with correct settings
SELECT
    'Test 2: Trigger Function' as test_name,
    p.proname as function_name,
    CASE
        WHEN prosecdef THEN 'SECURITY DEFINER ✓'
        ELSE 'SECURITY INVOKER ✗'
    END as security,
    proconfig as settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user';

-- Test 3: Verify trigger exists
SELECT
    'Test 3: Trigger Exists' as test_name,
    trigger_name,
    event_manipulation,
    action_timing,
    'EXISTS ✓' as status
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
    AND trigger_name = 'on_auth_user_created';

-- Test 4: Verify user_role enum values
SELECT
    'Test 4: Enum Values' as test_name,
    enumlabel as value,
    enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'user_role'
ORDER BY enumsortorder;

-- Test 5: Verify RLS policies
SELECT
    'Test 5: RLS Policies' as test_name,
    policyname,
    cmd as command,
    roles,
    CASE
        WHEN policyname LIKE '%service%' THEN 'CRITICAL FOR TRIGGER ✓'
        ELSE 'Standard Policy'
    END as importance
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'profiles'
ORDER BY policyname;

-- Test 6: Verify permissions
SELECT
    'Test 6: Permissions' as test_name,
    grantee as role,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
    AND table_name = 'profiles'
GROUP BY grantee
ORDER BY grantee;

-- Test 7: CRITICAL - Test trigger in a realistic way
-- This simulates what actually happens during signup
DO $$
DECLARE
    test_user_id uuid;
    test_email text;
    profile_exists boolean;
BEGIN
    -- Generate test data
    test_user_id := gen_random_uuid();
    test_email := 'trigger-test-' || test_user_id::text || '@example.com';

    -- Simulate what Supabase does: Insert into auth.users
    -- This should trigger the profile creation
    BEGIN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_user_meta_data,
            created_at,
            updated_at,
            aud,
            role
        ) VALUES (
            test_user_id,
            '00000000-0000-0000-0000-000000000000',
            test_email,
            crypt('test-password', gen_salt('bf')),
            NOW(),
            jsonb_build_object('full_name', 'Trigger Test User'),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );

        -- Check if profile was created by trigger
        SELECT EXISTS(
            SELECT 1 FROM public.profiles WHERE id = test_user_id
        ) INTO profile_exists;

        IF profile_exists THEN
            RAISE NOTICE '✓ SUCCESS: Trigger automatically created profile!';
        ELSE
            RAISE EXCEPTION '✗ FAILED: Profile not created by trigger';
        END IF;

        -- Cleanup test data
        DELETE FROM auth.users WHERE id = test_user_id;
        -- Profile should be auto-deleted by CASCADE

        RAISE NOTICE '✓ Test completed and cleaned up successfully';

    EXCEPTION WHEN OTHERS THEN
        -- Cleanup on error
        DELETE FROM public.profiles WHERE id = test_user_id;
        DELETE FROM auth.users WHERE id = test_user_id;

        RAISE EXCEPTION '✗ FAILED: Trigger test failed - % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;
END $$;

-- Test 8: Verify data integrity
SELECT
    'Test 8: Data Integrity' as test_name,
    (SELECT COUNT(*) FROM auth.users) as auth_users,
    (SELECT COUNT(*) FROM public.profiles) as profiles,
    (SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM public.profiles) as missing_profiles,
    CASE
        WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles)
        THEN '✓ All users have profiles'
        ELSE '✗ Missing profiles detected'
    END as status;

-- Test 9: Check for orphaned profiles
SELECT
    'Test 9: Orphaned Profiles' as test_name,
    COUNT(*) as orphaned_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✓ No orphaned profiles'
        ELSE '✗ Found orphaned profiles'
    END as status
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE au.id IS NULL;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '  VERIFICATION COMPLETE';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'If Test 7 shows SUCCESS, the trigger is working!';
    RAISE NOTICE 'You can now test signup in your application.';
    RAISE NOTICE '';
END $$;

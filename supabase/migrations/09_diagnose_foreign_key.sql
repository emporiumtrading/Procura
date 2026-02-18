-- =====================================================
-- Diagnose Foreign Key Constraint Issue
-- =====================================================

-- Check 1: What foreign key constraints exist on profiles table?
SELECT
    'Foreign Key Constraints' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'profiles'
    AND tc.table_schema = 'public';

-- Check 2: Full profiles table structure
SELECT
    'Profiles Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check 3: Test if the foreign key is the issue
-- This will show us the exact constraint violation
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
BEGIN
    -- First, try without creating an auth.users record
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (test_id, 'test@example.com', 'Test', 'viewer'::user_role);

    RAISE NOTICE 'SUCCESS: No foreign key blocking insert';
    DELETE FROM public.profiles WHERE id = test_id;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'CONFIRMED: Foreign key constraint "profiles_id_fkey" blocks inserts';
        RAISE NOTICE 'Details: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Different error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Check 4: What does the original schema say about this constraint?
SELECT
    'Constraint Definition' as info,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'profiles_id_fkey';

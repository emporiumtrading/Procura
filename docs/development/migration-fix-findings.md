# Database Migration Fix - Findings Summary

**Date:** February 5, 2026  
**Issue:** Migration script causing duplicate policy error  
**Status:** ✅ RESOLVED

---

## Problem

When running `supabase/migrations/04_fix_auth.sql`, the following error occurred:

```
ERROR: 42710: policy "Users can insert own profile" for table "profiles" already exists
```

---

## Root Cause Analysis

The original migration script attempted to create RLS policies without checking if they already existed. This caused failures when:

1. Running the migration multiple times
2. Running after migrations `01` and `02` had already created the base schema
3. The policy was already in place from a previous partial run

### Why This Happened

The original script used:
```sql
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
```

PostgreSQL **does not have** `CREATE POLICY IF NOT EXISTS`, so re-running this statement fails.

---

## Solution Implemented

### 1. Idempotent Policy Creation

Changed policy creation to use conditional logic:

```sql
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
```

**Why this works:**
- Queries `pg_policies` system catalog to check existence
- Only creates policy if it doesn't exist
- Safe to run multiple times

### 2. Proper Enum Casting

Fixed the trigger function to properly cast string literals to enum type:

```sql
-- BEFORE (could fail if TEXT/enum mismatch)
role = 'viewer'

-- AFTER (explicit cast)
role = 'viewer'::user_role
```

### 3. ON CONFLICT Handling

Made the trigger truly idempotent:

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (...)
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
  last_active = NOW();
```

**Benefits:**
- Handles duplicate signup attempts gracefully
- Updates email if user changes it
- Preserves existing `full_name` if new one is null
- Always updates `last_active` timestamp

---

## Documentation Created

### New File: `docs/development/troubleshooting-database.md`

Comprehensive guide covering:
- ✅ Auth trigger errors and fixes
- ✅ Policy duplication errors
- ✅ Type/enum errors
- ✅ Foreign key violations
- ✅ RLS debugging
- ✅ Connection pool issues
- ✅ Best practices for idempotent migrations

---

## Migration Script Updated

**File:** `supabase/migrations/04_fix_auth.sql`

Now includes:
- ✅ Conditional policy creation (no duplicates)
- ✅ Proper enum type casting
- ✅ Idempotent trigger function
- ✅ Permission grants
- ✅ Profile sync for existing users
- ✅ Verification query

---

## How to Use

### For This Specific Error:

1. **Open Supabase Dashboard** → SQL Editor
2. **Delete previous migration attempt** (if it partially ran):
   ```sql
   DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
   ```
3. **Run the corrected migration:**
   - Copy entire contents of `supabase/migrations/04_fix_auth.sql`
   - Paste in SQL Editor
   - Click **Run**
4. **Verify success:**
   ```sql
   SELECT 
     COUNT(DISTINCT au.id) as total_auth_users,
     COUNT(DISTINCT p.id) as total_profiles,
     COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as missing_profiles
   FROM auth.users au
   LEFT JOIN public.profiles p ON p.id = au.id;
   ```
   Expected: `missing_profiles = 0`

5. **Test signup** in the application

---

## Prevention for Future Migrations

### Always Use Idempotent Patterns

```sql
-- ✅ Tables
CREATE TABLE IF NOT EXISTS ...

-- ✅ Functions
CREATE OR REPLACE FUNCTION ...

-- ✅ Triggers
DROP TRIGGER IF EXISTS ... ON ...;
CREATE TRIGGER ...

-- ✅ Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE ...) THEN
    CREATE POLICY ...
  END IF;
END $$;

-- ✅ Indexes
CREATE INDEX IF NOT EXISTS ...

-- ✅ Enums (careful - can't alter existing)
DO $$ BEGIN
  CREATE TYPE ... AS ENUM (...);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### Migration Checklist

Before committing any migration:
- [ ] Can it run multiple times safely?
- [ ] Does it check for existing objects?
- [ ] Are type casts explicit (`::type_name`)?
- [ ] Is there a rollback plan?
- [ ] Has it been tested locally?

---

## Impact

- **Users Affected:** Anyone running `04_fix_auth.sql` after migrations `01-03`
- **Resolution Time:** Immediate (script corrected)
- **Downtime:** None (migrations run offline)
- **Data Loss:** None

---

## Related Files

- `supabase/migrations/04_fix_auth.sql` - Corrected migration
- `docs/development/troubleshooting-database.md` - Troubleshooting guide
- `supabase/migrations/01_schema.sql` - Original schema with trigger
- `supabase/migrations/02_rls_policies.sql` - RLS policies

---

## Testing Performed

✅ Tested on fresh Supabase instance  
✅ Tested on instance with existing policies  
✅ Verified policy `pg_policies` query works  
✅ Confirmed enum casting works  
✅ Validated profile sync for existing users  
✅ Confirmed trigger fires on new signups  

---

## Lessons Learned

1. **PostgreSQL doesn't support `CREATE POLICY IF NOT EXISTS`** - Must use `DO $$ ... END $$` blocks
2. **Always cast enums explicitly** - Don't rely on implicit conversion
3. **System catalogs are your friend** - `pg_policies`, `pg_trigger`, `pg_proc`
4. **Test migrations twice** - Fresh DB and pre-populated DB
5. **Document tribal knowledge** - Idempotency patterns should be standard

---

**Status:** Ready for production ✅

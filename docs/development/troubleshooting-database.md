# Database Troubleshooting Guide

This guide covers common database and authentication issues you may encounter during development.

---

## 🔴 "Database error saving new user"

### Symptoms
- User signup fails with error: "Database error saving new user"
- Cannot create new accounts in the application
- Error occurs during Supabase Auth signup process

### Root Cause
This error occurs when the database trigger that creates user profiles fails. Common reasons:

1. **Migrations not run in order** - The `profiles` table or enums may not exist
2. **Duplicate policy creation** - Re-running migration scripts without idempotency checks
3. **Type mismatches** - `user_role` enum not properly cast in trigger function
4. **Missing permissions** - Trigger doesn't have proper grants to insert into `profiles`

### Solution

Run the corrected migration script:

```sql
-- Located at: supabase/migrations/04_fix_auth.sql
```

**Steps:**
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Copy contents of `supabase/migrations/04_fix_auth.sql`
4. Click **Run**
5. Verify with the verification query at the end of the file

### What the Fix Does

1. **Recreates the trigger function** with proper enum casting: `'viewer'::user_role`
2. **Uses ON CONFLICT** to handle duplicate profile attempts idempotently
3. **Conditional policy creation** using `DO $$ ... END $$` block to avoid duplicate policy errors
4. **Syncs existing users** - Creates profiles for any auth users missing them
5. **Grants proper permissions** - Ensures trigger has necessary rights

### Verification

After running the fix, execute this query to confirm:

```sql
SELECT 
  COUNT(DISTINCT au.id) as total_auth_users,
  COUNT(DISTINCT p.id) as total_profiles,
  COUNT(DISTINCT au.id) - COUNT(DISTINCT p.id) as missing_profiles
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;
```

Expected result: `missing_profiles` should be `0`.

---

## 🔴 Policy Already Exists Error

### Error Message
```
ERROR: 42710: policy "PolicyName" for table "TableName" already exists
```

### Cause
Migration scripts attempting to create policies that already exist from previous runs.

### Solution
Always use conditional creation for policies:

```sql
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'your_table' 
    AND policyname = 'Your Policy Name'
  ) THEN
    CREATE POLICY "Your Policy Name"
      ON your_table FOR SELECT
      USING (true);
  END IF;
END $$;
```

Or use `DROP POLICY IF EXISTS` before creation:

```sql
DROP POLICY IF EXISTS "Your Policy Name" ON your_table;
CREATE POLICY "Your Policy Name" ON your_table FOR SELECT USING (true);
```

---

## 🔴 Type Does Not Exist Error

### Error Message
```
ERROR: type "user_role" does not exist
```

### Cause
Migrations run out of order - enums must be created before tables that reference them.

### Solution
Ensure migrations run in numerical order:

1. `01_schema.sql` - Creates enums and base tables
2. `02_rls_policies.sql` - Creates RLS policies
3. `03_admin_tables.sql` - Creates admin-specific tables
4. `04_fix_auth.sql` - Fixes auth trigger (if needed)

**Never skip migrations or run them out of order.**

---

## 🔴 Foreign Key Constraint Violation

### Error Message
```
ERROR: insert or update on table "X" violates foreign key constraint
```

### Cause
Attempting to reference a row in another table that doesn't exist.

### Common Scenarios

1. **Profile doesn't exist for user**
   - Run `04_fix_auth.sql` to sync profiles
   
2. **Referenced entity deleted**
   - Check `ON DELETE CASCADE` constraints in schema
   
3. **Wrong UUID**
   - Verify the ID you're referencing actually exists

### Debug Query
```sql
-- Check if referenced entity exists
SELECT * FROM parent_table WHERE id = 'uuid-here';
```

---

## 🔴 RLS Policy Blocking Access

### Symptoms
- Queries return empty results even though data exists
- `SELECT` works but `INSERT`/`UPDATE` fails with no error
- Admin tools show data, but application doesn't

### Cause
Row-Level Security (RLS) policies preventing access.

### Debug Steps

1. **Check if RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

2. **View current policies:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

3. **Test with service role** (bypasses RLS):
   - Use `SUPABASE_SERVICE_ROLE_KEY` instead of `ANON_KEY`
   - If this works, it's an RLS issue

### Solution
Review and update policies in `02_rls_policies.sql`.

---

## 🔴 Trigger Function Not Firing

### Symptoms
- Auth user created but no profile
- Expected automatic behavior doesn't happen

### Debug Steps

1. **Check if trigger exists:**
```sql
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_auth_user_created';
```

2. **Check function definition:**
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

3. **Test function manually:**
```sql
-- Get a user ID
SELECT id, email FROM auth.users LIMIT 1;

-- Test profile creation
INSERT INTO profiles (id, email, full_name, role)
VALUES ('user-id-here', 'test@example.com', 'Test User', 'viewer'::user_role);
```

### Solution
Run `04_fix_auth.sql` to recreate trigger with proper definition.

---

## 🔴 Connection Pool Exhausted

### Error Message
```
FATAL: remaining connection slots are reserved
```

### Cause
Too many concurrent database connections.

### Solution

1. **For Supabase Free Tier:**
   - Maximum 60 connections
   - Reduce connection pool size in backend

2. **Backend Configuration:**
```python
# backend/database.py
supabase = create_client(
    url=settings.SUPABASE_URL,
    key=settings.SUPABASE_SERVICE_ROLE_KEY,
    options=ClientOptions(
        postgrest_client_timeout=10,
        storage_client_timeout=10,
        max_connections=20  # Add this
    )
)
```

3. **Close connections properly:**
```python
async with supabase.postgrest.from_('table').select('*').execute() as response:
    data = response.data
# Connection auto-closed
```

---

## 🟡 Best Practices

### Writing Idempotent Migrations

Always make migrations safe to re-run:

```sql
-- Tables
CREATE TABLE IF NOT EXISTS ...

-- Functions
CREATE OR REPLACE FUNCTION ...

-- Triggers
DROP TRIGGER IF EXISTS trigger_name ON table_name;
CREATE TRIGGER trigger_name ...

-- Policies
DO $$ 
BEGIN
  IF NOT EXISTS (...) THEN
    CREATE POLICY ...
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_name ON table(column);
```

### Migration Checklist

Before running a migration:

- [ ] Backup database (if production)
- [ ] Test in local Supabase instance first
- [ ] Verify dependencies (enums, tables, functions exist)
- [ ] Check for idempotency (`IF NOT EXISTS`, `OR REPLACE`)
- [ ] Review RLS policies impact
- [ ] Have rollback plan ready

---

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Migration Best Practices](../development/backend.md#migrations)

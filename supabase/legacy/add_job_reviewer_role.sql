-- Migration: add job_reviewer to the role CHECK constraint
-- Run this in Supabase SQL Editor if the profiles table already has the role column

-- Step 1: Drop existing CHECK constraint on role (find it dynamically)
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(con_name);
    RAISE NOTICE 'Dropped constraint: %', con_name;
  ELSE
    RAISE NOTICE 'No existing role constraint found, adding fresh.';
  END IF;
END $$;

-- Step 2: Add new constraint including job_reviewer
ALTER TABLE profiles ADD CONSTRAINT profiles_role_valid
  CHECK (role IN ('admin', 'moderator', 'business_owner', 'job_reviewer', 'user'));

-- Add role and verified columns to profiles table
-- If column already exists, this is a no-op
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- Drop any existing role CHECK constraint and recreate with job_reviewer included
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
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_valid
  CHECK (role IN ('admin', 'moderator', 'business_owner', 'job_reviewer', 'user'));

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Usage:
-- Job Reviewer: UPDATE profiles SET role = 'job_reviewer' WHERE id = '<user-id>';
-- Moderator:    UPDATE profiles SET role = 'moderator'    WHERE id = '<user-id>';
-- Admin:        UPDATE profiles SET role = 'admin'        WHERE id = '<user-id>';
-- Business:     UPDATE profiles SET role = 'business_owner' WHERE id = '<user-id>';
-- Verify:       UPDATE profiles SET verified = true        WHERE id = '<user-id>';

-- Add bio and avatar_url columns to profiles table
-- Run this once in the Supabase SQL Editor

alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;

-- Add subdomain support to listings
-- Run this in your Supabase SQL editor

alter table listings
  add column if not exists subdomain text unique;

create index if not exists listings_subdomain_idx on listings (subdomain);

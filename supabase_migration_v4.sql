-- ============================================
-- Bitcoin City - Migration V4
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add is_admin flag to buildings (only one building should be admin at a time)
alter table buildings add column if not exists is_admin boolean default false not null;

-- Index for quick admin lookup
create index if not exists idx_buildings_is_admin on buildings(is_admin) where is_admin = true;

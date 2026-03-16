-- ============================================
-- Bitcoin City - Migration V2
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add verified status to buildings
alter table buildings add column if not exists verified boolean default false;

-- Add building message (shown when someone clicks the building)
alter table buildings add column if not exists message text default '';

-- Add wallet_changes counter to track how many times user changed wallet
alter table profiles add column if not exists wallet_changes int default 0;

-- Update existing records
update buildings set verified = false where verified is null;
update buildings set message = '' where message is null;
update profiles set wallet_changes = 0 where wallet_changes is null;

-- ============================================
-- Bitcoin City - Migration V3
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add verification_deadline to buildings (for 1+ BTC holders)
alter table buildings add column if not exists verification_deadline timestamptz default null;

-- Create verification_requests table
create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  btc_address text not null,
  tx_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- RLS policies for verification_requests
alter table verification_requests enable row level security;

-- Users can read their own requests
create policy "Users can read own verification requests"
  on verification_requests for select
  using (auth.uid() = user_id);

-- Users can insert their own requests
create policy "Users can insert own verification requests"
  on verification_requests for insert
  with check (auth.uid() = user_id);

-- Service role can do everything (admin operations go through service role key)
-- No explicit policy needed for service role as it bypasses RLS

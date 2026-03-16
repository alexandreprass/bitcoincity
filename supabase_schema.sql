-- ============================================
-- Bitcoin City - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Wallets table
create table if not exists wallets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade unique not null,
  btc_address text not null,
  balance_satoshis bigint default 0 not null,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Buildings table
create table if not exists buildings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade unique not null,
  username text not null,
  display_name text not null,
  btc_address text not null,
  balance_satoshis bigint default 0 not null,
  height float default 1 not null,
  position_x float default 0 not null,
  position_z float default 0 not null,
  color text default '#4A90D9' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists idx_wallets_btc_address on wallets(btc_address);
create index if not exists idx_buildings_balance on buildings(balance_satoshis desc);

-- RLS (Row Level Security)
alter table profiles enable row level security;
alter table wallets enable row level security;
alter table buildings enable row level security;

-- Profiles: users can read all, but only update their own
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Wallets: users can read all, but only modify their own
create policy "Wallets are viewable by everyone"
  on wallets for select using (true);

create policy "Users can insert their own wallet"
  on wallets for insert with check (auth.uid() = user_id);

create policy "Users can update own wallet"
  on wallets for update using (auth.uid() = user_id);

-- Buildings: everyone can read, users can modify their own
create policy "Buildings are viewable by everyone"
  on buildings for select using (true);

create policy "Users can insert their own building"
  on buildings for insert with check (auth.uid() = user_id);

create policy "Users can update own building"
  on buildings for update using (auth.uid() = user_id);

-- Function to handle new user signup (auto-create profile)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

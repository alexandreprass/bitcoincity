-- ============================================
-- Bitcoin City - Migration V5: Character System
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add character column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS character text DEFAULT 'adventurer' NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS character_changes integer DEFAULT 0 NOT NULL;

-- Add character column to buildings (for fast lookups without joins)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS character text DEFAULT 'adventurer' NOT NULL;

-- Assign random characters to existing users who still have default
DO $$
DECLARE
  chars text[] := ARRAY['adventurer','astronaut','beach','business','casual','farmer','hoodie','king','punk','swat','worker'];
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE character = 'adventurer'
  LOOP
    UPDATE profiles SET character = chars[1 + floor(random() * 11)::int] WHERE id = r.id;
  END LOOP;
END $$;

-- Sync character from profiles to buildings for existing users
UPDATE buildings b
SET character = p.character
FROM profiles p
WHERE b.user_id = p.id;

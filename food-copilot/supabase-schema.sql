-- Supabase Schema for Food Co-Pilot
-- Run this in Supabase SQL Editor (https://txvfwighxvsgocseyxmh.supabase.co)

-- Products table: cached from Open Food Facts
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT UNIQUE NOT NULL,
  product_name TEXT,
  brand TEXT,
  ingredients_text TEXT,
  nutrition_facts_json JSONB,
  source TEXT DEFAULT 'openfoodfacts',
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Normalized ingredients: ingredient taxonomy with flags
CREATE TABLE IF NOT EXISTS normalized_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name TEXT NOT NULL,
  normalized_name TEXT,
  ingredient_type TEXT,
  flags_json JSONB,
  UNIQUE(raw_name)
);

-- Reasoning sessions: traceability for AI responses
CREATE TABLE IF NOT EXISTS reasoning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  detected_signals_json JSONB,
  ai_explanation TEXT,
  uncertainty_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_reasoning_product ON reasoning_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_raw_name ON normalized_ingredients(raw_name);

-- Enable Row Level Security (required by Supabase)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalized_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_sessions ENABLE ROW LEVEL SECURITY;

-- Policies: Allow public read/write for this prototype
-- (In production, you'd restrict this)
CREATE POLICY "Allow public read on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON products FOR UPDATE USING (true);

CREATE POLICY "Allow public read on normalized_ingredients" ON normalized_ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public insert on normalized_ingredients" ON normalized_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on normalized_ingredients" ON normalized_ingredients FOR UPDATE USING (true);

CREATE POLICY "Allow public read on reasoning_sessions" ON reasoning_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on reasoning_sessions" ON reasoning_sessions FOR INSERT WITH CHECK (true);

-- =====================================================
-- USER FEATURES: Profiles, Scan History, Preferences
-- =====================================================

-- User profiles: linked to Supabase Auth
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  dietary_restrictions TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scan history: cloud-synced, 50 non-favorites per user
-- Note: References auth.users directly (not user_profiles) to avoid foreign key issues
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  barcode TEXT NOT NULL,
  product_name TEXT,
  brand TEXT,
  nova_group INTEGER,
  nutri_score TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  is_favorite BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_scan_history_user ON scan_history(user_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_favorite ON scan_history(user_id, is_favorite);

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_history_limit ON scan_history;
DROP FUNCTION IF EXISTS limit_scan_history();

-- Trigger function: keep only 50 non-favorite scans per user
CREATE OR REPLACE FUNCTION limit_scan_history() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM scan_history 
  WHERE id IN (
    SELECT id FROM scan_history 
    WHERE user_id = NEW.user_id AND is_favorite = FALSE
    ORDER BY scanned_at DESC 
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_history_limit
AFTER INSERT ON scan_history
FOR EACH ROW EXECUTE FUNCTION limit_scan_history();

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, dietary_restrictions, allergens)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    '{}',
    '{}'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own history" ON scan_history;
DROP POLICY IF EXISTS "Users can insert own history" ON scan_history;
DROP POLICY IF EXISTS "Users can update own history" ON scan_history;
DROP POLICY IF EXISTS "Users can delete own history" ON scan_history;

-- User profiles: users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Scan history: users can only access their own history
CREATE POLICY "Users can view own history" ON scan_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON scan_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history" ON scan_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON scan_history
  FOR DELETE USING (auth.uid() = user_id);

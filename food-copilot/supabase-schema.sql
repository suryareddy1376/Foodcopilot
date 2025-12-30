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

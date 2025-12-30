import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types matching our locked schema
export interface Product {
  id: string
  barcode: string
  product_name: string | null
  brand: string | null
  ingredients_text: string | null
  nutrition_facts_json: Record<string, any> | null
  source: string
  last_synced_at: string
}

export interface NormalizedIngredient {
  id: string
  raw_name: string
  normalized_name: string | null
  ingredient_type: string | null
  flags_json: Record<string, any> | null
}

export interface ReasoningSession {
  id: string
  product_id: string
  detected_signals_json: Record<string, any> | null
  ai_explanation: string | null
  uncertainty_notes: string | null
  created_at: string
}

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000

export async function getCachedProduct(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .single()

  if (error || !data) return null

  // Check if cache is still valid
  const lastSynced = new Date(data.last_synced_at).getTime()
  const now = Date.now()
  
  if (now - lastSynced > CACHE_DURATION_MS) {
    return null // Cache expired
  }

  return data
}

export async function upsertProduct(product: Omit<Product, 'id' | 'last_synced_at'>): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .upsert({
      ...product,
      last_synced_at: new Date().toISOString()
    }, {
      onConflict: 'barcode'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting product:', error)
    return null
  }

  return data
}

export async function getNormalizedIngredient(rawName: string): Promise<NormalizedIngredient | null> {
  const { data, error } = await supabase
    .from('normalized_ingredients')
    .select('*')
    .eq('raw_name', rawName.toLowerCase())
    .single()

  if (error) return null
  return data
}

export async function upsertNormalizedIngredient(
  ingredient: Omit<NormalizedIngredient, 'id'>
): Promise<NormalizedIngredient | null> {
  const { data, error } = await supabase
    .from('normalized_ingredients')
    .upsert({
      ...ingredient,
      raw_name: ingredient.raw_name.toLowerCase()
    }, {
      onConflict: 'raw_name'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting ingredient:', error)
    return null
  }

  return data
}

export async function createReasoningSession(
  session: Omit<ReasoningSession, 'id' | 'created_at'>
): Promise<ReasoningSession | null> {
  const { data, error } = await supabase
    .from('reasoning_sessions')
    .insert(session)
    .select()
    .single()

  if (error) {
    console.error('Error creating reasoning session:', error)
    return null
  }

  return data
}

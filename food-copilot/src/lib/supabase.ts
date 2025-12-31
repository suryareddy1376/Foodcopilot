import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create Supabase client with proper auth persistence for browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'food-copilot-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

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

// =====================================================
// USER PROFILE TYPES & FUNCTIONS
// =====================================================

export interface UserProfile {
  id: string
  display_name: string | null
  dietary_restrictions: string[]
  allergens: string[]
  created_at: string
  updated_at: string
}

export interface ScanHistoryItem {
  id: string
  user_id: string
  product_id: string | null
  barcode: string
  product_name: string | null
  brand: string | null
  nova_group: number | null
  nutri_score: string | null
  scanned_at: string
  is_favorite: boolean
}

// Dietary restriction options
export const DIETARY_RESTRICTIONS = [
  { id: 'vegan', label: 'Vegan', description: 'No animal products' },
  { id: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish' },
  { id: 'halal', label: 'Halal', description: 'Islamic dietary law' },
  { id: 'kosher', label: 'Kosher', description: 'Jewish dietary law' },
  { id: 'keto', label: 'Keto', description: 'Low-carb, high-fat' },
  { id: 'paleo', label: 'Paleo', description: 'No processed foods, grains, dairy' },
  { id: 'gluten-free', label: 'Gluten-Free', description: 'No gluten-containing grains' },
  { id: 'lactose-free', label: 'Lactose-Free', description: 'No lactose/dairy sugar' },
  { id: 'low-sodium', label: 'Low Sodium', description: 'Reduced salt intake' },
  { id: 'low-sugar', label: 'Low Sugar', description: 'Reduced sugar intake' },
] as const

// Common allergens (based on major food allergens)
export const COMMON_ALLERGENS = [
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'tree-nuts', label: 'Tree Nuts', examples: 'almonds, cashews, walnuts' },
  { id: 'milk', label: 'Milk/Dairy' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'wheat', label: 'Wheat' },
  { id: 'soy', label: 'Soy' },
  { id: 'fish', label: 'Fish' },
  { id: 'shellfish', label: 'Shellfish', examples: 'shrimp, crab, lobster' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'sulfites', label: 'Sulfites' },
  { id: 'mustard', label: 'Mustard' },
  { id: 'celery', label: 'Celery' },
  { id: 'lupin', label: 'Lupin' },
  { id: 'mollusks', label: 'Mollusks', examples: 'clams, mussels, oysters' },
] as const

// Get user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
  return data
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'display_name' | 'dietary_restrictions' | 'allergens'>>
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating user profile:', error)
    return null
  }
  return data
}

// =====================================================
// SCAN HISTORY FUNCTIONS
// =====================================================

// Get user's scan history
export async function getScanHistory(userId: string, limit = 50): Promise<ScanHistoryItem[]> {
  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching scan history:', error)
    return []
  }
  return data || []
}

// Add to scan history
export async function addToScanHistory(
  userId: string,
  item: Omit<ScanHistoryItem, 'id' | 'user_id' | 'scanned_at' | 'is_favorite'>
): Promise<ScanHistoryItem | null> {
  console.log('addToScanHistory called with userId:', userId, 'barcode:', item.barcode)
  
  // Verify we have an active session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error('No active session - cannot save to history')
    return null
  }
  console.log('Session verified, user:', session.user.id)

  // Check if this barcode was recently scanned (within last 5 minutes) to avoid duplicates
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: existing, error: checkError } = await supabase
    .from('scan_history')
    .select('id')
    .eq('user_id', userId)
    .eq('barcode', item.barcode)
    .gte('scanned_at', fiveMinutesAgo)
    .limit(1)

  if (checkError) {
    console.error('Error checking for duplicates:', checkError.message, checkError.code, checkError.hint)
  }

  if (existing && existing.length > 0) {
    console.log('Skipping duplicate scan within 5 minutes')
    return null
  }

  console.log('Inserting scan history record...')
  const { data, error } = await supabase
    .from('scan_history')
    .insert({
      user_id: userId,
      barcode: item.barcode,
      product_name: item.product_name,
      brand: item.brand,
      nova_group: item.nova_group,
      nutri_score: item.nutri_score,
      product_id: item.product_id,
      is_favorite: false
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding to scan history:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return null
  }
  
  console.log('✅ Successfully saved to scan history:', data?.id)
  return data
}

// Toggle favorite status
export async function toggleFavorite(historyId: string, isFavorite: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('scan_history')
    .update({ is_favorite: isFavorite })
    .eq('id', historyId)

  if (error) {
    console.error('Error toggling favorite:', error)
    return false
  }
  return true
}

// Delete from scan history
export async function deleteFromHistory(historyId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scan_history')
    .delete()
    .eq('id', historyId)

  if (error) {
    console.error('Error deleting from history:', error)
    return false
  }
  return true
}

// Clear all non-favorite history
export async function clearHistory(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scan_history')
    .delete()
    .eq('user_id', userId)
    .eq('is_favorite', false)

  if (error) {
    console.error('Error clearing history:', error)
    return false
  }
  return true
}

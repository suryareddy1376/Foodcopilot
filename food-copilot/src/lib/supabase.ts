import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if Supabase is properly configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase')

// Create Supabase client with proper auth persistence for browser
export const supabase: SupabaseClient = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'food-copilot-auth',
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { persistSession: false }
    })

// Export configuration status for components to check
export const isDbConfigured = isSupabaseConfigured

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
}

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
  console.log('getScanHistory called for user:', userId)
  
  try {
    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    })
    
    const queryPromise = supabase
      .from('scan_history')
      .select('*')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit)
    
    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

    if (error) {
      console.error('Error fetching scan history:', error.message, error.code)
      return []
    }
    
    console.log('getScanHistory returned:', data?.length || 0, 'items')
    return data || []
  } catch (err: any) {
    console.error('getScanHistory exception:', err.message)
    return []
  }
}

// Add to scan history - uses API route for reliable authentication
export async function addToScanHistory(
  userId: string,
  item: Omit<ScanHistoryItem, 'id' | 'user_id' | 'scanned_at' | 'is_favorite'>
): Promise<{ data: ScanHistoryItem | null; error: string | null }> {
  console.log('addToScanHistory called with userId:', userId, 'barcode:', item.barcode)
  
  try {
    // Get current session for API authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError.message)
      // Try to refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshData.session) {
        return { data: null, error: 'Session expired. Please log in again to save scan history.' }
      }
    }
    
    let activeSession = session
    if (!activeSession) {
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshData.session) {
        console.error('Failed to refresh session:', refreshError?.message)
        return { data: null, error: 'Not logged in. Please log in to save scan history.' }
      }
      activeSession = refreshData.session
      console.log('Session refreshed successfully')
    }

    // Use API route for reliable server-side authentication
    // This bypasses potential client-side RLS issues
    const response = await fetch('/api/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeSession.access_token}`
      },
      body: JSON.stringify({
        barcode: item.barcode,
        product_name: item.product_name || null,
        brand: item.brand || null,
        nova_group: item.nova_group || null,
        nutri_score: item.nutri_score || null,
        product_id: item.product_id || null
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('API error saving to history:', result)
      
      // If API fails, try direct insert as fallback
      console.log('Trying direct insert as fallback...')
      return await addToScanHistoryDirect(userId, item, activeSession)
    }

    console.log('✅ Successfully saved to scan history via API:', result.item?.id)
    return { data: result.item, error: null }
    
  } catch (err: any) {
    console.error('Unexpected error in addToScanHistory:', err)
    return { data: null, error: 'Failed to save scan. Please try again.' }
  }
}

// Direct insert fallback (used when API fails)
async function addToScanHistoryDirect(
  userId: string,
  item: Omit<ScanHistoryItem, 'id' | 'user_id' | 'scanned_at' | 'is_favorite'>,
  session: any
): Promise<{ data: ScanHistoryItem | null; error: string | null }> {
  try {
    // Verify user ID matches session
    const currentUserId = session?.user?.id
    if (currentUserId && currentUserId !== userId) {
      console.warn('User ID mismatch - using session user ID')
      userId = currentUserId
    }

    // Check if this barcode was recently scanned (within last 2 minutes) to avoid duplicates
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('scan_history')
      .select('id, barcode, product_name')
      .eq('user_id', userId)
      .eq('barcode', item.barcode)
      .gte('scanned_at', twoMinutesAgo)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log('Skipping duplicate scan within 2 minutes')
      return { data: existing[0] as unknown as ScanHistoryItem, error: null }
    }

    console.log('Inserting scan history record directly...')
    const { data, error } = await supabase
      .from('scan_history')
      .insert({
        user_id: userId,
        barcode: item.barcode,
        product_name: item.product_name || null,
        brand: item.brand || null,
        nova_group: item.nova_group || null,
        nutri_score: item.nutri_score || null,
        product_id: item.product_id || null,
        is_favorite: false
      })
      .select()
      .single()

    if (error) {
      console.error('Direct insert error:', error)
      return { data: null, error: 'Failed to save to history' }
    }
    
    console.log('✅ Successfully saved to scan history (direct):', data?.id)
    return { data, error: null }
  } catch (err) {
    console.error('Direct insert exception:', err)
    return { data: null, error: 'Failed to save to history' }
  }
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

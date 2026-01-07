// Open Food Facts API integration
// Docs: https://wiki.openfoodfacts.org/API

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2'
const OFF_WRITE_BASE = 'https://world.openfoodfacts.org/cgi'

// Open Food Facts credentials for write operations
const OFF_USERNAME = process.env.OFF_USERNAME || 'suryareddy13767'
const OFF_PASSWORD = process.env.OFF_PASSWORD || 'iFnhBZv4Jh!U9s7'

export interface OpenFoodFactsProduct {
  code: string
  product_name?: string
  brands?: string
  ingredients_text?: string
  ingredients_text_en?: string
  additives_tags?: string[]
  additives_n?: number
  nova_group?: number
  nova_groups_markers?: Record<string, string[]>
  nutriscore_grade?: string
  nutriments?: Record<string, number>
  allergens_tags?: string[]
  categories_tags?: string[]
  labels_tags?: string[]
  image_url?: string
}

export interface OFFResponse {
  status: number
  status_verbose: string
  product?: OpenFoodFactsProduct
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 20000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// Normalize barcode - handle various formats
export function normalizeBarcode(barcode: string): string {
  // Remove any non-digit characters
  let normalized = barcode.replace(/\D/g, '')

  // Pad EAN-8 to EAN-13 if needed (some databases store both ways)
  // Don't pad if already 12-14 digits (UPC-A or EAN-13)
  if (normalized.length === 8) {
    // Keep as-is, EAN-8 is valid
    return normalized
  }

  // Some scanners add leading zeros - normalize UPC-A (12 digits) to EAN-13
  if (normalized.length === 12) {
    normalized = '0' + normalized
  }

  return normalized
}

export interface FetchProductResult {
  product: OpenFoodFactsProduct | null
  error?: 'not_found' | 'network_error' | 'timeout' | 'invalid_barcode' | 'server_error'
  message?: string
}

export async function fetchProductFromOFF(barcode: string, retries: number = 2): Promise<FetchProductResult> {
  // Validate barcode format
  const cleanBarcode = barcode.replace(/\D/g, '')
  if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
    return {
      product: null,
      error: 'invalid_barcode',
      message: `Invalid barcode length: ${cleanBarcode.length} digits. Expected 8-14 digits.`
    }
  }

  const normalizedBarcode = normalizeBarcode(cleanBarcode)
  const barcodesToTry = [normalizedBarcode]

  // Also try original if different (some products are indexed under original barcode)
  if (normalizedBarcode !== cleanBarcode) {
    barcodesToTry.push(cleanBarcode)
  }

  // For UPC-A/EAN-13, also try without leading zero
  if (normalizedBarcode.length === 13 && normalizedBarcode.startsWith('0')) {
    barcodesToTry.push(normalizedBarcode.substring(1))
  }

  console.log(`[OFF] Fetching product, trying barcodes: ${barcodesToTry.join(', ')}`)

  let lastError: 'network_error' | 'timeout' | 'server_error' = 'network_error'

  for (const barcodeVariant of barcodesToTry) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          `${OFF_API_BASE}/product/${barcodeVariant}.json`,
          {
            headers: {
              'User-Agent': 'FoodCoPilot/1.0 (https://github.com/food-copilot; contact@example.com)',
              'Accept': 'application/json'
            }
          },
          attempt === 0 ? 20000 : 30000 // Longer timeout on retry
        )

        if (response.status === 404) {
          // Product not found - try next barcode variant
          break
        }

        if (!response.ok) {
          console.error('OFF API error:', response.status, response.statusText)
          lastError = 'server_error'
          // Retry on server errors
          if (response.status >= 500 && attempt < retries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          break
        }

        const data: OFFResponse = await response.json()

        if (data.status === 1 && data.product) {
          console.log(`[OFF] Found product: ${data.product.product_name || 'Unknown'}, NutriScore: ${data.product.nutriscore_grade || 'N/A'}, NOVA: ${data.product.nova_group || 'N/A'}`)
          return { product: data.product }
        }

        console.log(`[OFF] Product not found for barcode variant: ${barcodeVariant}`)
        // status !== 1 means product not found in this variant
        break

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn(`OFF API timeout (attempt ${attempt + 1}) for barcode: ${barcodeVariant}`)
          lastError = 'timeout'
        } else {
          console.error('Error fetching from OFF:', error.message)
          lastError = 'network_error'
        }

        // Retry with exponential backoff
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }
  }

  // All attempts failed
  return {
    product: null,
    error: 'not_found',
    message: 'Product not found in OpenFoodFacts database. This might be a regional product or one that hasn\'t been cataloged yet.'
  }
}

// Transform OFF product to our database schema
export function transformOFFProduct(offProduct: OpenFoodFactsProduct) {
  const transformed = {
    barcode: offProduct.code,
    product_name: offProduct.product_name || null,
    brand: offProduct.brands || null,
    ingredients_text: offProduct.ingredients_text || offProduct.ingredients_text_en || null,
    nutrition_facts_json: {
      nova_group: offProduct.nova_group ?? null,
      nutriscore: offProduct.nutriscore_grade || null,
      additives_tags: offProduct.additives_tags || [],
      additives_count: offProduct.additives_n || 0,
      allergens: offProduct.allergens_tags || [],
      categories: offProduct.categories_tags || [],
      labels: offProduct.labels_tags || [],
      nutriments: offProduct.nutriments || {}
    },
    source: 'openfoodfacts'
  }

  console.log(`[OFF Transform] Result - nova_group: ${transformed.nutrition_facts_json.nova_group}, nutriscore: ${transformed.nutrition_facts_json.nutriscore}, ingredients: ${transformed.ingredients_text?.substring(0, 50)}...`)

  return transformed
}

// Search products by name (for future use)
export async function searchProducts(query: string, limit: number = 10): Promise<OpenFoodFactsProduct[]> {
  try {
    const response = await fetchWithTimeout(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=${limit}`,
      {
        headers: {
          'User-Agent': 'FoodCoPilot/1.0 (https://github.com/food-copilot; contact@example.com)',
          'Accept': 'application/json'
        }
      },
      15000
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.products || []
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('Search timeout')
    } else {
      console.error('Error searching OFF:', error.message)
    }
    return []
  }
}

// Add or update a product in Open Food Facts (authenticated)
export async function addProductToOFF(
  barcode: string,
  productData: {
    product_name?: string
    brands?: string
    ingredients_text?: string
    categories?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new URLSearchParams()
    formData.append('code', barcode)
    formData.append('user_id', OFF_USERNAME)
    formData.append('password', OFF_PASSWORD)

    if (productData.product_name) {
      formData.append('product_name', productData.product_name)
    }
    if (productData.brands) {
      formData.append('brands', productData.brands)
    }
    if (productData.ingredients_text) {
      formData.append('ingredients_text', productData.ingredients_text)
    }
    if (productData.categories) {
      formData.append('categories', productData.categories)
    }

    // Comment to track contributions
    formData.append('comment', 'Added via Food Co-Pilot app')

    const response = await fetch(`${OFF_WRITE_BASE}/product_jqm2.pl`, {
      method: 'POST',
      headers: {
        'User-Agent': 'FoodCoPilot/1.0 (https://github.com/food-copilot; contact@example.com)',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OFF write error:', response.status, errorText)
      return { success: false, error: `HTTP ${response.status}` }
    }

    const result = await response.json()

    if (result.status === 1 || result.status_verbose === 'fields saved') {
      return { success: true }
    } else {
      return { success: false, error: result.status_verbose || 'Unknown error' }
    }
  } catch (error) {
    console.error('Error adding product to OFF:', error)
    return { success: false, error: String(error) }
  }
}

// =====================================================
// HEALTHIER ALTERNATIVES SEARCH
// =====================================================

export interface AlternativeProduct {
  barcode: string
  name: string
  brand: string | null
  nutriScore: string | null
  novaGroup: number | null
  whyBetter: string[]
  imageUrl: string | null
}

// NutriScore ranking for comparison (A is best, E is worst)
const NUTRI_SCORE_RANK: Record<string, number> = { 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5 }

export async function searchAlternatives(
  categories: string[],
  currentNutriScore: string | null,
  currentNovaGroup: number | null,
  currentBarcode: string,
  limit: number = 3
): Promise<AlternativeProduct[]> {
  try {
    if (!categories || categories.length === 0) {
      return []
    }

    // Get the most specific category (usually the last one)
    // Categories are like: ['en:snacks', 'en:sweet-snacks', 'en:biscuits', 'en:chocolate-biscuits']
    const category = categories[Math.min(categories.length - 1, 2)]
      .replace('en:', '')
      .replace(/-/g, ' ')

    // Search in the category, sorted by nutrition grade
    const response = await fetchWithTimeout(
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(category)}&` +
      `sort_by=nutrition_grade_fr&` +
      `page_size=20&` +
      `json=1`,
      {
        headers: {
          'User-Agent': 'FoodCoPilot/1.0 (https://github.com/food-copilot; contact@example.com)',
          'Accept': 'application/json'
        }
      },
      15000
    )

    if (!response.ok) return []

    const data = await response.json()
    const products: OpenFoodFactsProduct[] = data.products || []

    // Filter and rank alternatives
    const alternatives: AlternativeProduct[] = []
    const currentNutriRank = currentNutriScore ? NUTRI_SCORE_RANK[currentNutriScore.toLowerCase()] || 5 : 5
    const currentNova = currentNovaGroup || 4

    for (const product of products) {
      // Skip the same product
      if (product.code === currentBarcode) continue

      // Skip products without names or nutriscore
      if (!product.product_name || !product.nutriscore_grade) continue

      const productNutriRank = NUTRI_SCORE_RANK[product.nutriscore_grade.toLowerCase()] || 5
      const productNova = product.nova_group || 4

      // Only include if it's better in at least one metric
      const betterNutri = productNutriRank < currentNutriRank
      const betterNova = productNova < currentNova
      const sameOrBetterNutri = productNutriRank <= currentNutriRank
      const sameOrBetterNova = productNova <= currentNova

      if ((betterNutri && sameOrBetterNova) || (betterNova && sameOrBetterNutri)) {
        const whyBetter: string[] = []

        if (betterNutri) {
          whyBetter.push(`Better NutriScore (${product.nutriscore_grade.toUpperCase()} vs ${currentNutriScore?.toUpperCase() || '?'})`)
        }
        if (betterNova) {
          whyBetter.push(`Less processed (NOVA ${productNova} vs ${currentNova})`)
        }

        // Add specific nutrient comparisons if available
        if (product.nutriments) {
          if (product.nutriments.sugars_100g !== undefined && product.nutriments.sugars_100g < 5) {
            whyBetter.push('Low sugar')
          }
          if (product.nutriments.sodium_100g !== undefined && product.nutriments.sodium_100g < 0.3) {
            whyBetter.push('Low sodium')
          }
          if (product.nutriments['saturated-fat_100g'] !== undefined && product.nutriments['saturated-fat_100g'] < 1.5) {
            whyBetter.push('Low saturated fat')
          }
        }

        alternatives.push({
          barcode: product.code,
          name: product.product_name,
          brand: product.brands || null,
          nutriScore: product.nutriscore_grade,
          novaGroup: product.nova_group || null,
          whyBetter,
          imageUrl: product.image_url || null
        })

        if (alternatives.length >= limit) break
      }
    }

    return alternatives
  } catch (error) {
    console.error('Error searching alternatives:', error)
    return []
  }
}

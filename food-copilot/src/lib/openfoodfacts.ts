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

export async function fetchProductFromOFF(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const response = await fetch(`${OFF_API_BASE}/product/${barcode}.json`, {
      headers: {
        // Required by Open Food Facts API guidelines
        'User-Agent': 'FoodCoPilot/1.0 (https://github.com/food-copilot; contact@example.com)'
      }
    })

    if (!response.ok) {
      console.error('OFF API error:', response.status)
      return null
    }

    const data: OFFResponse = await response.json()

    if (data.status !== 1 || !data.product) {
      return null
    }

    return data.product
  } catch (error) {
    console.error('Error fetching from OFF:', error)
    return null
  }
}

// Transform OFF product to our database schema
export function transformOFFProduct(offProduct: OpenFoodFactsProduct) {
  return {
    barcode: offProduct.code,
    product_name: offProduct.product_name || null,
    brand: offProduct.brands || null,
    ingredients_text: offProduct.ingredients_text || offProduct.ingredients_text_en || null,
    nutrition_facts_json: {
      nova_group: offProduct.nova_group,
      nutriscore: offProduct.nutriscore_grade,
      additives_tags: offProduct.additives_tags || [],
      additives_count: offProduct.additives_n || 0,
      allergens: offProduct.allergens_tags || [],
      categories: offProduct.categories_tags || [],
      labels: offProduct.labels_tags || [],
      nutriments: offProduct.nutriments || {}
    },
    source: 'openfoodfacts'
  }
}

// Search products by name (for future use)
export async function searchProducts(query: string, limit: number = 10): Promise<OpenFoodFactsProduct[]> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=${limit}`,
      {
        headers: {
          'User-Agent': 'FoodCoPilot/1.0 (https://github.com/food-copilot; contact@example.com)'
        }
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.products || []
  } catch (error) {
    console.error('Error searching OFF:', error)
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

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchProductFromOFF, transformOFFProduct } from '@/lib/openfoodfacts'
import { getCachedProduct, upsertProduct } from '@/lib/supabase'

const client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: 'https://api.thesys.dev/v1/embed'
})

interface ProductData {
  barcode: string
  product_name: string | null
  brand: string | null
  ingredients_text: string | null
  nova_group: number | null
  nutri_score: string | null
  nutrition_facts: Record<string, any>
}

async function getProductData(barcode: string): Promise<ProductData | null> {
  // Check cache first
  let product = await getCachedProduct(barcode)
  
  if (!product) {
    // Fetch from Open Food Facts
    const offProduct = await fetchProductFromOFF(barcode)
    if (!offProduct) return null
    
    const transformed = transformOFFProduct(offProduct)
    product = await upsertProduct(transformed)
    
    if (!product) {
      product = {
        id: 'temp',
        ...transformed,
        last_synced_at: new Date().toISOString()
      }
    }
  }

  const nutritionFacts = product.nutrition_facts_json || {}
  
  return {
    barcode: product.barcode,
    product_name: product.product_name,
    brand: product.brand,
    ingredients_text: product.ingredients_text,
    nova_group: nutritionFacts.nova_group || null,
    nutri_score: nutritionFacts.nutriscore || null,
    nutrition_facts: nutritionFacts
  }
}

async function generateComparisonAnalysis(products: ProductData[]): Promise<string> {
  const productSummaries = products.map((p, i) => `
Product ${i + 1}: ${p.product_name || 'Unknown'}${p.brand ? ` by ${p.brand}` : ''}
- NutriScore: ${p.nutri_score?.toUpperCase() || 'N/A'}
- NOVA Group: ${p.nova_group || 'N/A'}
- Ingredients: ${p.ingredients_text || 'Not available'}
`).join('\n')

  const prompt = `Compare these ${products.length} food products and help the user choose the healthier option:

${productSummaries}

Generate a Thesys Generative UI JSON response that:
1. Shows a clear comparison with a Header
2. Uses a table or MiniCardBlock to compare key metrics side-by-side
3. Highlights the "winner" for each category (NutriScore, NOVA, ingredients)
4. Provides a brief CalloutV2 with the overall recommendation
5. Lists key differences in processing level, additives, and nutrition
6. Be balanced - mention trade-offs if any

Focus on: processing level (NOVA), nutritional quality (NutriScore), ingredient quality, and additive count.`

  const THESYS_SYSTEM = `You are a health co-pilot comparing food products. You MUST respond with Thesys Generative UI JSON format only.

Your response must be a valid JSON object with this exact structure:
{
  "component": {
    "component": "Card",
    "props": {
      "children": [...]
    }
  },
  "error": null
}

Available components:
- Card: Main container {"component": "Card", "props": {"children": [...]}}
- Header: {"component": "Header", "props": {"title": "string", "subtitle": "optional string"}}
- MiniCardBlock: {"component": "MiniCardBlock", "props": {"children": [MiniCard components]}}
- MiniCard: {"component": "MiniCard", "props": {"lhs": DataTile component}}
- DataTile: {"component": "DataTile", "props": {"amount": "value", "description": "label", "child": Icon component}}
- Icon: {"component": "Icon", "props": {"name": "icon-name"}}
  Icons: trophy, trending-up, trending-down, check-circle, x-circle, shield-check, shield-alert, scale, star, heart, leaf, zap, package
- TextContent: {"component": "TextContent", "props": {"textMarkdown": "text"}}
- TagBlock: {"component": "TagBlock", "props": {"children": [{"text": "label", "variant": "success|warning|error|info"}]}}
- SectionBlock: {"component": "SectionBlock", "props": {"isFoldable": true, "sections": [{"value": "id", "trigger": "Title", "content": [...]}]}}
- List: {"component": "List", "props": {"items": [{"title": "string", "subtitle": "string", "iconName": "icon-name"}]}}
- CalloutV2: {"component": "CalloutV2", "props": {"variant": "success|warning|error|info", "title": "string", "description": "string"}}

CRITICAL: Output ONLY valid JSON. No markdown, no text before or after.`

  try {
    const completion = await client.chat.completions.create({
      model: 'c1/anthropic/claude-sonnet-4/v-20251230',
      messages: [
        { role: 'system', content: THESYS_SYSTEM },
        { role: 'user', content: prompt }
      ],
      stream: false
    })

    return completion.choices[0]?.message?.content || 'Unable to generate comparison.'
  } catch (error) {
    console.error('Thesys C1 comparison error:', error)
    return 'Comparison temporarily unavailable. Please try again.'
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { barcodes } = body

    // Validate input
    if (!barcodes || !Array.isArray(barcodes) || barcodes.length < 2 || barcodes.length > 3) {
      return NextResponse.json(
        { error: 'Please provide 2-3 barcodes to compare' },
        { status: 400 }
      )
    }

    // Validate barcode formats
    for (const barcode of barcodes) {
      if (!/^\d{8,14}$/.test(barcode)) {
        return NextResponse.json(
          { error: `Invalid barcode format: ${barcode}` },
          { status: 400 }
        )
      }
    }

    // Fetch product data for all barcodes
    const productPromises = barcodes.map(barcode => getProductData(barcode))
    const products = await Promise.all(productPromises)

    // Check if all products were found
    const notFound = products.map((p, i) => p ? null : barcodes[i]).filter(Boolean)
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `Products not found: ${notFound.join(', ')}` },
        { status: 404 }
      )
    }

    const validProducts = products.filter((p): p is ProductData => p !== null)

    // Generate comparison analysis
    const analysis = await generateComparisonAnalysis(validProducts)

    // Determine winner based on NutriScore and NOVA
    let winner: string | null = null
    const scores = validProducts.map(p => {
      const nutriScore = p.nutri_score?.toLowerCase().charCodeAt(0) || 999
      const nova = p.nova_group || 5
      return { product: p.product_name, score: nutriScore + nova * 10 }
    })
    scores.sort((a, b) => a.score - b.score)
    if (scores[0].score < scores[1].score) {
      winner = scores[0].product
    }

    return NextResponse.json({
      products: validProducts.map(p => ({
        barcode: p.barcode,
        product_name: p.product_name,
        brand: p.brand,
        nova_group: p.nova_group,
        nutri_score: p.nutri_score
      })),
      analysis,
      winner
    })

  } catch (error) {
    console.error('Compare error:', error)
    return NextResponse.json(
      { error: 'Failed to compare products' },
      { status: 500 }
    )
  }
}

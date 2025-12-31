import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchProductFromOFF, transformOFFProduct } from '@/lib/openfoodfacts'
import { detectSignals, UserPreferences, UserConflict } from '@/lib/signals'
import { getCachedProduct, upsertProduct, createReasoningSession } from '@/lib/supabase'

const client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: 'https://api.thesys.dev/v1/embed'
})

async function getAIAnalysis(
  productName: string, 
  brand: string | null, 
  ingredients: string | null, 
  signals: any, 
  novaGroup?: number, 
  nutriScore?: string,
  userConflicts?: UserConflict[],
  userPreferences?: UserPreferences | null
): Promise<string> {
  const signalSummary = signals.signals.length > 0
    ? `Detected signals:\n${signals.signals.map((s: any) => `- ${s.type}: ${s.message}`).join('\n')}`
    : 'No significant signals detected.'

  const flaggedAdditiveSummary = signals.flaggedAdditives
    .filter((a: any) => a.concern !== 'none')
    .map((a: any) => `- ${a.additive}: ${a.concern} concern - ${a.note}`)
    .join('\n')

  // User-specific conflicts section
  const userConflictsSummary = userConflicts && userConflicts.length > 0
    ? `\n⚠️ USER-SPECIFIC ALERTS (PRIORITIZE THESE):\n${userConflicts.map(c => 
        `- ${c.severity === 'danger' ? '🚨 ALLERGEN' : '⚠️ DIETARY'}: ${c.description}\n  Found: ${c.evidence.join(', ')}`
      ).join('\n')}`
    : ''

  const userDietInfo = userPreferences && (userPreferences.dietary_restrictions.length > 0 || userPreferences.allergens.length > 0)
    ? `\nUser's dietary profile:
- Restrictions: ${userPreferences.dietary_restrictions.join(', ') || 'None'}
- Allergens to avoid: ${userPreferences.allergens.join(', ') || 'None'}`
    : ''

  const prompt = `Analyze this food product and generate a Thesys Generative UI response:

Product: ${productName}${brand ? ` by ${brand}` : ''}
Ingredients: ${ingredients || 'Not available'}
NOVA Group: ${novaGroup || 'Unknown'}
NutriScore: ${nutriScore || 'Unknown'}
${userDietInfo}
${signalSummary}
${userConflictsSummary}
${flaggedAdditiveSummary ? `Additives of note:\n${flaggedAdditiveSummary}` : ''}

Generate a comprehensive Thesys UI JSON response with:
1. Header with product name and brand
2. ${userConflicts && userConflicts.length > 0 ? 'FIRST: A prominent CalloutV2 with variant="error" for any allergen alerts or variant="warning" for dietary conflicts' : ''}
3. MiniCardBlock showing NOVA group and NutriScore with appropriate icons
4. TagBlock with quick status tags (FDA status, processing level, etc.)
5. SectionBlock with foldable sections for:
   - ${userConflicts && userConflicts.length > 0 ? 'Personal conflicts (highlighted)' : 'Ingredient breakdown'}
   - Health concerns (if any)
   - Positive aspects
6. Be balanced and evidence-based, avoid fear-mongering
${userConflicts && userConflicts.length > 0 ? '\nIMPORTANT: The user has specific dietary needs. Make any conflicts VERY visible at the top of the response.' : ''}`

  const THESYS_SYSTEM = `You are a health co-pilot that analyzes food products. You MUST respond with Thesys Generative UI JSON format only.

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
  Icons: shield-check, shield-alert, zap, package, clock, alert-triangle, check-circle, info, leaf, heart, activity, beaker, apple, flame, scale, star, x-circle, trending-up
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

    return completion.choices[0]?.message?.content || 'Unable to generate analysis.'
  } catch (error) {
    console.error('Thesys C1 error:', error)
    return 'Analysis temporarily unavailable. Please try again.'
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params

  // Get user preferences from query params (passed from frontend)
  const { searchParams } = new URL(request.url)
  const dietaryRestrictions = searchParams.get('dietary')?.split(',').filter(Boolean) || []
  const allergens = searchParams.get('allergens')?.split(',').filter(Boolean) || []
  
  const userPreferences: UserPreferences | null = 
    (dietaryRestrictions.length > 0 || allergens.length > 0)
      ? { dietary_restrictions: dietaryRestrictions, allergens }
      : null

  // Validate barcode format
  if (!/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json(
      { error: 'Invalid barcode format' },
      { status: 400 }
    )
  }

  try {
    // Step 1: Check cache
    let product = await getCachedProduct(barcode)
    let offProduct = null

    // Step 2: Fetch from Open Food Facts if not cached
    if (!product) {
      offProduct = await fetchProductFromOFF(barcode)
      
      if (!offProduct) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }

      // Transform and cache
      const transformed = transformOFFProduct(offProduct)
      product = await upsertProduct(transformed)

      if (!product) {
        // If cache fails, continue with in-memory data
        product = {
          id: 'temp',
          ...transformed,
          last_synced_at: new Date().toISOString()
        }
      }
    }

    // Step 3: Detect signals
    const nutritionFacts = product.nutrition_facts_json || {}
    const signals = detectSignals(
      product.ingredients_text,
      nutritionFacts.additives_tags || [],
      nutritionFacts.nova_group || null,
      nutritionFacts.nutriscore || null,
      userPreferences
    )

    // Step 4: Get AI analysis using Thesys C1
    const aiResult = await getAIAnalysis(
      product.product_name || 'Unknown product',
      product.brand,
      product.ingredients_text,
      signals,
      nutritionFacts.nova_group,
      nutritionFacts.nutriscore,
      signals.userConflicts,
      userPreferences
    )

    // Step 5: Store reasoning session (non-blocking)
    if (product.id !== 'temp') {
      createReasoningSession({
        product_id: product.id,
        detected_signals_json: { signals: signals.signals, flagged: signals.flaggedAdditives },
        ai_explanation: aiResult,
        uncertainty_notes: signals.summary.hasDebatedIngredients 
          ? 'Contains ingredients under ongoing scientific review'
          : null
      }).catch(err => console.error('Failed to save reasoning session:', err))
    }

    // Return response
    return NextResponse.json({
      product: {
        barcode: product.barcode,
        product_name: product.product_name,
        brand: product.brand,
        nova_group: nutritionFacts.nova_group,
        nutri_score: nutritionFacts.nutriscore,
        product_id: product.id !== 'temp' ? product.id : null
      },
      signals: signals.signals,
      userConflicts: signals.userConflicts,
      analysis: aiResult,
      meta: {
        cached: !offProduct,
        signals_detected: signals.signals.length,
        additives_flagged: signals.flaggedAdditives.filter(a => a.concern !== 'none').length,
        user_conflicts: signals.userConflicts.length,
        personalized: !!userPreferences
      }
    })

  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze product' },
      { status: 500 }
    )
  }
}

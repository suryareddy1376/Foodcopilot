import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchProductFromOFF, transformOFFProduct, searchAlternatives, normalizeBarcode, AlternativeProduct, FetchProductResult } from '@/lib/openfoodfacts'
import { detectSignals, detectHealthConditionRisks, UserPreferences, UserConflict, HealthConditionRisk } from '@/lib/signals'
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
  userPreferences?: UserPreferences | null,
  healthConditionRisks?: HealthConditionRisk[],
  alternatives?: AlternativeProduct[],
  barcode?: string
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

  // Health condition risks section
  const healthRisksSummary = healthConditionRisks && healthConditionRisks.length > 0
    ? `\n🏥 HEALTH CONDITION ALERTS (INCLUDE HealthRiskAlerts COMPONENT):\n${healthConditionRisks.map(r =>
      `- ${r.risk.toUpperCase()} RISK for ${r.conditionLabel}: ${r.reason}\n  Recommendation: ${r.recommendation}`
    ).join('\n')}`
    : ''

  // Alternatives section  
  const alternativesSummary = alternatives && alternatives.length > 0
    ? `\n💡 HEALTHIER ALTERNATIVES FOUND (INCLUDE AlternativeProducts COMPONENT):\n${alternatives.map(a =>
      `- ${a.name}${a.brand ? ` by ${a.brand}` : ''} (NutriScore: ${a.nutriScore?.toUpperCase() || '?'}, NOVA: ${a.novaGroup || '?'})\n  Why better: ${a.whyBetter.join(', ')}`
    ).join('\n')}`
    : ''

  const userDietInfo = userPreferences && (userPreferences.dietary_restrictions.length > 0 || userPreferences.allergens.length > 0 || (userPreferences.health_conditions && userPreferences.health_conditions.length > 0))
    ? `\nUser's health profile:
- Dietary restrictions: ${userPreferences.dietary_restrictions.join(', ') || 'None'}
- Allergens to avoid: ${userPreferences.allergens.join(', ') || 'None'}
- Health conditions: ${userPreferences.health_conditions?.join(', ') || 'None'}`
    : ''

  // Determine confidence level based on data completeness
  // Note: novaGroup can be 0 which is falsy, so use explicit check
  const hasIngredients = !!ingredients && ingredients.length > 10
  const hasNutriScore = !!nutriScore && nutriScore.length > 0
  const hasNovaGroup = novaGroup !== undefined && novaGroup !== null

  console.log(`[AI Analysis] Data check - ingredients: ${hasIngredients}, nutriscore: ${hasNutriScore} (${nutriScore}), nova: ${hasNovaGroup} (${novaGroup})`)

  const confidenceLevel = hasIngredients && hasNutriScore && hasNovaGroup ? 'high'
    : hasIngredients ? 'medium'
      : 'low'

  const confidenceReason = confidenceLevel === 'high'
    ? 'Complete product data available'
    : confidenceLevel === 'medium'
      ? 'Partial data - some scores unavailable'
      : 'Limited data - missing key information'

  // Check if we should show failure transparency (insufficient data)
  const shouldShowFailure = !hasIngredients && !hasNutriScore && !hasNovaGroup

  // If insufficient data, return failure transparency response
  if (shouldShowFailure) {
    return JSON.stringify({
      component: {
        component: 'Card',
        props: {
          children: [
            { component: 'AIInterpretationLabel', props: { label: 'AI Analysis Incomplete' } },
            { component: 'ProductHero', props: { 
              name: productName || 'Unknown Product', 
              brand: brand || null,
              nutriScore: null,
              novaGroup: null,
              barcode: barcode
            }},
            { component: 'ConfidenceIndicator', props: { 
              level: 'low', 
              reason: 'Unable to retrieve complete product data from barcode - additional information needed for accurate analysis' 
            }},
            { component: 'KeyFindings', props: { findings: [
              { type: 'warning', title: 'Limited Data Available', detail: 'Product barcode found but ingredient information is incomplete or missing from the database.' },
              { type: 'neutral', title: 'Why This Happens', detail: 'Some products have limited data in OpenFoodFacts, especially regional or new products.' }
            ]}},
            { component: 'FailureTransparency', props: {} },
            { component: 'AISummarySection', props: {
              title: 'What We Know',
              summary: 'Food Co-Pilot avoids guessing when ingredient disclosure is limited. This ensures you receive reliable, evidence-based guidance rather than speculation.',
              icon: 'info'
            }},
            { component: 'ContextualActions', props: { actions: [
              { label: 'Scan Ingredients Label', description: 'Take a photo of the ingredients list', icon: 'camera', action: 'scan-ingredients', variant: 'primary' },
              { label: 'Try Another Product', description: 'Scan a different barcode', icon: 'scan-barcode', action: 'scan-barcode', variant: 'secondary' }
            ]}},
            { component: 'SuggestionChips', props: {
              suggestions: [
                { text: '📷 Scan Ingredients', query: 'scan_ingredients' },
                { text: '🔄 Refresh Data', query: barcode ? `refresh:${barcode}` : 'scan another product' },
                { text: 'Ask about this product', query: `What do you know about ${productName || 'this product'}?` }
              ]
            }}
          ]
        }
      },
      error: null
    })
  }

  const prompt = `You are analyzing ACTUAL PRODUCT DATA from OpenFoodFacts database. Generate a comprehensive, structured Thesys Generative UI response.

CRITICAL: This is REAL DATA already fetched. Analyze it directly - do NOT say you "cannot access" anything.

=== PRODUCT DATA (ALREADY FETCHED FROM OPENFOODFACTS) ===
Product Name: ${productName}${brand ? ` by ${brand}` : ''}
Ingredients: ${ingredients || 'Not disclosed on package'}
NOVA Group: ${novaGroup !== undefined && novaGroup !== null ? novaGroup : 'Not available'} (1=Minimally processed, 4=Ultra-processed)
NutriScore: ${nutriScore || 'Not available'} (A=Best, E=Worst)
${userDietInfo}
${signalSummary}
${userConflictsSummary}
${healthRisksSummary}
${alternativesSummary}
${flaggedAdditiveSummary ? `Additives of note:\\n${flaggedAdditiveSummary}` : ''}

DATA QUALITY: Confidence ${confidenceLevel} - ${confidenceReason}

=== REQUIRED OUTPUT STRUCTURE (AI-NATIVE FORMAT) ===

Generate a Card containing these components IN THIS ORDER:

1. **AIInterpretationLabel** - Always start with this
   {"component": "AIInterpretationLabel", "props": {"label": "AI-Powered Analysis"}}

2. **ProductHero** - Product header with scores (REQUIRED)
   {"component": "ProductHero", "props": {
     "name": "${productName}",
     "brand": ${brand ? `"${brand}"` : 'null'},
     "nutriScore": ${nutriScore ? `"${nutriScore}"` : 'null'},
     "novaGroup": ${novaGroup !== undefined && novaGroup !== null ? novaGroup : 'null'},
     "barcode": "${barcode}"
   }}

3. **IntentInference** - State inferred intent upfront
   {"component": "IntentInference", "props": {"intent": "You're likely wondering if this product is safe for regular consumption and whether it aligns with your health goals."}}

4. **ConfidenceIndicator** - Show data confidence
   {"component": "ConfidenceIndicator", "props": {"level": "${confidenceLevel}", "reason": "${confidenceReason}"}}

5. **QuickInsights** - Key facts at a glance (generate 3-4 insights)
   {"component": "QuickInsights", "props": {"insights": [
     {"icon": "activity", "label": "Processing Level", "value": "NOVA X - Description", "sentiment": "good|neutral|bad"},
     {"icon": "star", "label": "Nutrition Grade", "value": "NutriScore X", "sentiment": "good|neutral|bad"},
     {"icon": "beaker", "label": "Additives", "value": "X flagged", "sentiment": "good|neutral|bad"}
   ]}}

6. **HealthRiskAlerts** (ONLY if health risks detected in data above)

7. **KeyFindings** - Structured findings (generate 3-5 findings)
   {"component": "KeyFindings", "props": {"findings": [
     {"type": "positive", "title": "Finding title", "detail": "Detailed explanation"},
     {"type": "warning", "title": "Caution area", "detail": "What to watch out for"},
     {"type": "negative", "title": "Concern", "detail": "Why this matters"}
   ]}}
   Types: positive (green), warning (yellow), negative (red), neutral (gray)

8. **IngredientSpotlight** - Highlight 2-4 notable ingredients
   {"component": "IngredientSpotlight", "props": {"ingredients": [
     {"name": "Ingredient Name", "category": "concern|beneficial|neutral|additive", "reason": "Why it matters", "learnMoreQuery": "Tell me about X"}
   ]}}

9. **AISummarySection** - Your synthesized assessment
   {"component": "AISummarySection", "props": {
     "title": "My Assessment",
     "summary": "2-3 sentence synthesis of your overall analysis and recommendation",
     "icon": "sparkles"
   }}

10. **ReasoningBlocks** - Show structured thinking
    {"component": "ReasoningBlocks", "props": {"blocks": [
      {"type": "thinking", "content": "What you're likely concerned about..."},
      {"type": "why-matters", "content": "Why this matters for your health..."},
      {"type": "tradeoffs", "content": "The benefits vs concerns..."},
      {"type": "bottom-line", "content": "My recommendation..."}
    ]}}

11. **DecisionVerdict** - REQUIRED clear verdict
    {"component": "DecisionVerdict", "props": {
      "verdict": "safe|occasional|avoid",
      "summary": "Clear one-sentence explanation"
    }}
    Rules:
    - "safe" (🟢): NOVA 1-2, NutriScore A-B, minimal additives
    - "occasional" (🟡): NOVA 3-4, NutriScore C-D, processed but not harmful
    - "avoid" (🔴): Contains user's allergens OR genuinely harmful

12. **UncertaintyDisclosure** - What we don't know (2-3 items)
    {"component": "UncertaintyDisclosure", "props": {"items": [
      "What we cannot verify or determine from available data"
    ]}}

13. **AlternativeProducts** (ONLY if alternatives provided in data above)

14. **ContextualActions** - Smart next steps
    {"component": "ContextualActions", "props": {"actions": [
      {"label": "Find Healthier Options", "description": "Compare with alternatives", "icon": "trending-up", "action": "ask-question", "query": "Show me healthier alternatives to ${productName}", "variant": "primary"},
      {"label": "Scan Another", "description": "Check a different product", "icon": "scan-barcode", "action": "scan-barcode", "variant": "secondary"}
    ]}}

15. **SuggestionChips** - Follow-up questions
    {"component": "SuggestionChips", "props": {"suggestions": [
      {"text": "Is this safe for children?", "query": "Is ${productName} safe for children?"},
      {"text": "Explain the additives", "query": "Explain each additive in ${productName}"},
      {"text": "Daily intake limits", "query": "How much of ${productName} is safe per day?"}
    ]}}

OUTPUT ONLY VALID JSON with this exact wrapper:
{
  "component": {
    "component": "Card",
    "props": {
      "children": [... all components above ...]
    }
  },
  "error": null
}`

  const THESYS_SYSTEM = `You are an AI Health Co-Pilot that analyzes food products using structured, AI-native interfaces. You MUST respond with Thesys Generative UI JSON format only.

CRITICAL: You will receive ACTUAL PRODUCT DATA already fetched from OpenFoodFacts. NEVER say you "cannot access" anything. Analyze the data provided directly.

Your response must be a valid JSON object:
{
  "component": {
    "component": "Card",
    "props": {
      "children": [... components array ...]
    }
  },
  "error": null
}

=== AI-NATIVE STRUCTURED COMPONENTS ===

**ProductHero** - Rich product header with visual scores
{"component": "ProductHero", "props": {
  "name": "Product Name", "brand": "Brand or null", 
  "nutriScore": "a|b|c|d|e or null", "novaGroup": 1-4 or null, "barcode": "123"
}}

**QuickInsights** - At-a-glance key facts (3-4 insights)
{"component": "QuickInsights", "props": {"insights": [
  {"icon": "activity|star|beaker|heart", "label": "Label", "value": "Value", "sentiment": "good|neutral|bad"}
]}}

**KeyFindings** - Structured analysis findings
{"component": "KeyFindings", "props": {"findings": [
  {"type": "positive|negative|warning|neutral", "title": "Finding", "detail": "Explanation"}
]}}

**IngredientSpotlight** - Notable ingredients
{"component": "IngredientSpotlight", "props": {"ingredients": [
  {"name": "Name", "category": "concern|beneficial|neutral|additive", "reason": "Why notable", "learnMoreQuery": "Question"}
]}}

**AISummarySection** - Your synthesized assessment
{"component": "AISummarySection", "props": {"title": "My Assessment", "summary": "2-3 sentence synthesis", "icon": "sparkles"}}

**ContextualActions** - Smart next actions
{"component": "ContextualActions", "props": {"actions": [
  {"label": "Action", "description": "What it does", "icon": "icon-name", "action": "scan-barcode|scan-ingredients|ask-question", "query": "optional query", "variant": "primary|secondary"}
]}}

**DecisionVerdict** - REQUIRED clear verdict
{"component": "DecisionVerdict", "props": {"verdict": "safe|occasional|avoid", "summary": "One sentence"}}
- safe (🟢): NOVA 1-2, NutriScore A-B, minimal processing
- occasional (🟡): NOVA 3-4, NutriScore C-D, processed but not harmful  
- avoid (🔴): Contains user allergens OR genuinely harmful

**Additional Components**:
- AIInterpretationLabel, IntentInference, ConfidenceIndicator
- ReasoningBlocks (blocks array with type: thinking|why-matters|tradeoffs|bottom-line)
- UncertaintyDisclosure (items array)
- HealthRiskAlerts (alerts array - USE ONLY if health risks detected)
- AlternativeProducts (alternatives array - USE ONLY if alternatives provided)
- SuggestionChips (suggestions array with text and query)

CRITICAL RULES:
1. Use ProductHero (not plain Header) for product display
2. ALWAYS include QuickInsights, KeyFindings, AISummarySection
3. ALWAYS include DecisionVerdict with appropriate verdict
4. ALWAYS include ContextualActions for next steps
5. Include HealthRiskAlerts ONLY if health condition risks are in the data
6. Include AlternativeProducts ONLY if alternatives are provided
7. Output ONLY valid JSON - no markdown, no text before/after`

  try {
    console.log(`[AI] Calling Thesys API for product: ${productName}`)
    const completion = await client.chat.completions.create({
      model: 'c1/anthropic/claude-sonnet-4/v-20251230',
      messages: [
        { role: 'system', content: THESYS_SYSTEM },
        { role: 'user', content: prompt }
      ],
      stream: false
    })

    const aiResponse = completion.choices[0]?.message?.content || 'Unable to generate analysis.'
    console.log(`[AI] Response received, length: ${aiResponse.length}, first 200 chars: ${aiResponse.substring(0, 200)}`)
    return aiResponse
  } catch (error: any) {
    console.error('Thesys C1 error:', error?.message || error)
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
  const healthConditions = searchParams.get('health')?.split(',').filter(Boolean) || []
  const forceRefresh = searchParams.get('refresh') === 'true'

  const userPreferences: UserPreferences | null =
    (dietaryRestrictions.length > 0 || allergens.length > 0 || healthConditions.length > 0)
      ? { dietary_restrictions: dietaryRestrictions, allergens, health_conditions: healthConditions }
      : null

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[Analyze API] Received request for barcode: ${barcode}`)
  console.log(`[Analyze API] User preferences:`, userPreferences)
  console.log(`${'='.repeat(60)}\n`)

  // Clean and validate barcode format
  const cleanBarcode = barcode.replace(/\D/g, '')
  if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
    return NextResponse.json(
      {
        error: 'Invalid barcode format',
        details: `Barcode should be 8-14 digits. Received: ${cleanBarcode.length} digits.`,
        suggestion: 'Please try scanning again or enter the barcode manually.'
      },
      { status: 400 }
    )
  }

  // Normalize barcode for database lookup
  const normalizedBarcode = normalizeBarcode(cleanBarcode)

  try {
    // Step 1: Check cache (try both normalized and original barcode)
    // Skip cache if force refresh is requested
    console.log(`[Analyze] Processing barcode: ${cleanBarcode}, forceRefresh: ${forceRefresh}`)

    let product = forceRefresh ? null : await getCachedProduct(normalizedBarcode)
    if (!product && !forceRefresh && normalizedBarcode !== cleanBarcode) {
      product = await getCachedProduct(cleanBarcode)
    }

    if (product) {
      console.log(`[Analyze] Found cached product: ${product.product_name}, ingredients: ${product.ingredients_text?.substring(0, 50)}...`)
    } else {
      console.log(`[Analyze] No cached product found for ${cleanBarcode}`)
    }

    let offProduct = null

    // Step 1.5: Check if cached data has incomplete critical fields
    // If so, force re-fetch from OpenFoodFacts to get updated data
    if (product) {
      // Handle case where nutrition_facts_json might be stored as string
      let nutritionFacts = product.nutrition_facts_json || {}
      if (typeof nutritionFacts === 'string') {
        try {
          nutritionFacts = JSON.parse(nutritionFacts)
        } catch (e) {
          nutritionFacts = {}
        }
      }

      const hasIngredients = !!product.ingredients_text && product.ingredients_text.length > 10
      const hasNutriScore = !!nutritionFacts.nutriscore && nutritionFacts.nutriscore.length > 0
      // nova_group can be 0 which is valid, so check for undefined/null explicitly
      const hasNovaGroup = nutritionFacts.nova_group !== undefined && nutritionFacts.nova_group !== null

      console.log(`[Analyze] Cache data check - ingredients: ${hasIngredients}, nutriscore: ${hasNutriScore} (${nutritionFacts.nutriscore}), nova: ${hasNovaGroup} (${nutritionFacts.nova_group})`)

      // If missing critical data, try to refresh from source
      if (!hasIngredients || !hasNutriScore || !hasNovaGroup) {
        console.log(`[Analyze] Cached product ${cleanBarcode} has incomplete data, refreshing from OFF...`)
        product = null // Force re-fetch
      }
    }

    // Step 2: Fetch from Open Food Facts if not cached
    if (!product) {
      console.log(`[Analyze] Fetching from OpenFoodFacts...`)
      const fetchResult = await fetchProductFromOFF(cleanBarcode)

      if (!fetchResult.product) {
        // Return detailed error based on what went wrong
        const errorResponses: Record<string, { message: string; suggestion: string; status: number }> = {
          'not_found': {
            message: 'Product not found',
            suggestion: 'This product may not be in the OpenFoodFacts database. Try scanning the ingredient list directly, or contribute by adding this product to OpenFoodFacts!',
            status: 404
          },
          'network_error': {
            message: 'Network error',
            suggestion: 'Please check your internet connection and try again.',
            status: 503
          },
          'timeout': {
            message: 'Request timed out',
            suggestion: 'The server is taking too long to respond. Please try again in a moment.',
            status: 504
          },
          'invalid_barcode': {
            message: 'Invalid barcode',
            suggestion: fetchResult.message || 'Please check the barcode and try again.',
            status: 400
          },
          'server_error': {
            message: 'Server error',
            suggestion: 'OpenFoodFacts is experiencing issues. Please try again later.',
            status: 502
          }
        }

        const errorInfo = errorResponses[fetchResult.error || 'not_found']

        return NextResponse.json(
          {
            error: errorInfo.message,
            details: fetchResult.message,
            suggestion: errorInfo.suggestion,
            barcode: cleanBarcode
          },
          { status: errorInfo.status }
        )
      }

      offProduct = fetchResult.product
      console.log(`[Analyze] OFF product received: ${offProduct.product_name}, nutriscore: ${offProduct.nutriscore_grade}, nova: ${offProduct.nova_group}`)

      // Transform and cache
      const transformed = transformOFFProduct(offProduct)
      console.log(`[Analyze] Transformed product - nutriscore: ${transformed.nutrition_facts_json?.nutriscore}, nova: ${transformed.nutrition_facts_json?.nova_group}`)

      product = await upsertProduct(transformed)

      if (!product) {
        console.log(`[Analyze] Cache upsert failed, using in-memory data`)
        // If cache fails, continue with in-memory data
        product = {
          id: 'temp',
          ...transformed,
          last_synced_at: new Date().toISOString()
        }
      } else {
        console.log(`[Analyze] Product cached successfully with id: ${product.id}`)
      }
    }

    // Step 3: Detect signals
    // Handle case where nutrition_facts_json might be stored as string in database
    let nutritionFacts = product.nutrition_facts_json || {}
    if (typeof nutritionFacts === 'string') {
      try {
        nutritionFacts = JSON.parse(nutritionFacts)
      } catch (e) {
        console.error('[Analyze] Failed to parse nutrition_facts_json:', e)
        nutritionFacts = {}
      }
    }

    console.log(`[Analyze] Product data - name: ${product.product_name}, ingredients length: ${product.ingredients_text?.length || 0}, nutriscore: ${nutritionFacts.nutriscore}, nova: ${nutritionFacts.nova_group}`)

    const signals = detectSignals(
      product.ingredients_text,
      nutritionFacts.additives_tags || [],
      nutritionFacts.nova_group || null,
      nutritionFacts.nutriscore || null,
      userPreferences
    )

    // Step 3.5: Detect health condition risks
    const healthConditionRisks = userPreferences?.health_conditions
      ? detectHealthConditionRisks(
        nutritionFacts.nutriments || null,
        product.ingredients_text,
        userPreferences.health_conditions
      )
      : []

    // Step 3.6: Search for healthier alternatives (in parallel with AI)
    const categoriesTags = nutritionFacts.categories || []
    const alternativesPromise = categoriesTags.length > 0
      ? searchAlternatives(
        categoriesTags,
        nutritionFacts.nutriscore || null,
        nutritionFacts.nova_group || null,
        barcode,
        3
      )
      : Promise.resolve([])

    // Step 4: Get AI analysis using Thesys C1
    const [aiResult, alternatives] = await Promise.all([
      getAIAnalysis(
        product.product_name || 'Unknown product',
        product.brand,
        product.ingredients_text,
        signals,
        nutritionFacts.nova_group,
        nutritionFacts.nutriscore,
        signals.userConflicts,
        userPreferences,
        healthConditionRisks,
        await alternativesPromise,
        cleanBarcode
      ),
      alternativesPromise
    ])

    // Step 5: Store reasoning session (non-blocking)
    if (product.id !== 'temp') {
      createReasoningSession({
        product_id: product.id,
        detected_signals_json: { signals: signals.signals, flagged: signals.flaggedAdditives, healthRisks: healthConditionRisks },
        ai_explanation: aiResult,
        uncertainty_notes: signals.summary.hasDebatedIngredients
          ? 'Contains ingredients under ongoing scientific review'
          : null
      }).catch(err => console.error('Failed to save reasoning session:', err))
    }

    // Return response
    console.log(`[Analyze] Returning response - product: ${product.product_name}, analysis length: ${aiResult?.length || 0}`)

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
      healthConditionRisks,
      alternatives,
      analysis: aiResult,
      meta: {
        cached: !offProduct,
        signals_detected: signals.signals.length,
        additives_flagged: signals.flaggedAdditives.filter(a => a.concern !== 'none').length,
        user_conflicts: signals.userConflicts.length,
        health_risks: healthConditionRisks.length,
        alternatives_found: alternatives.length,
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

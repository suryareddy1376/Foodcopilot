import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchProductFromOFF, transformOFFProduct, searchAlternatives, normalizeBarcode, AlternativeProduct, FetchProductResult } from '@/lib/openfoodfacts'
import { detectSignals, detectHealthConditionRisks, UserPreferences, UserConflict, HealthConditionRisk } from '@/lib/signals'
import { getCachedProduct, upsertProduct, createReasoningSession } from '@/lib/supabase'

// Validate API key exists
const THESYS_API_KEY = process.env.THESYS_API_KEY
if (!THESYS_API_KEY) {
  console.warn('⚠️ THESYS_API_KEY not configured - AI analysis will fail')
}

const client = new OpenAI({
  apiKey: THESYS_API_KEY || 'missing-key',
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

  const prompt = `You are Food Co-Pilot, an AI-native consumer health co-pilot.

Your job is NOT to list nutrition facts.
Your job is to reduce cognitive effort and help users make a food decision.

You must:
- Infer user intent without asking questions
- Reason about ingredients instead of dumping data
- Communicate uncertainty honestly
- Produce a clear decision verdict

=== PRODUCT DATA ===
Product: ${productName}${brand ? ` by ${brand}` : ''}
Ingredients: ${ingredients || 'Not disclosed'}
NOVA: ${novaGroup !== undefined && novaGroup !== null ? novaGroup : 'Unknown'} (1=Minimally processed, 4=Ultra-processed)
NutriScore: ${nutriScore || 'Unknown'} (A=Best, E=Worst)
${userDietInfo}
${signalSummary}
${userConflictsSummary}
${healthRisksSummary}
${alternativesSummary}
${flaggedAdditiveSummary ? `Additives of note:\n${flaggedAdditiveSummary}` : ''}

Data Confidence: ${confidenceLevel} - ${confidenceReason}

=== OUTPUT FORMAT (STRICT ORDER) ===

Generate Card with these children IN ORDER:

1. AIInterpretationLabel
   {"component": "AIInterpretationLabel", "props": {"label": "AI Interpretation"}}

2. IntentInference - INFER, don't ask
   {"component": "IntentInference", "props": {"intent": "I'm assuming you want to know if ${productName} is healthy and safe to eat regularly."}}

3. Header
   {"component": "Header", "props": {"title": "${productName} Analysis", "subtitle": "What you need to know"}}

4. ConfidenceIndicator
   {"component": "ConfidenceIndicator", "props": {"level": "${confidenceLevel}", "reason": "${confidenceReason}"}}

5. QuickInsights - 3 KEY metrics only (no raw data dumps)
   {"component": "QuickInsights", "props": {"insights": [
     {"icon": "activity", "label": "Processing", "value": "NOVA ${novaGroup ?? '?'}", "sentiment": "${novaGroup && novaGroup <= 2 ? 'good' : novaGroup === 3 ? 'neutral' : 'bad'}"},
     {"icon": "star", "label": "Nutrition grade", "value": "${nutriScore?.toUpperCase() || '?'}", "sentiment": "${nutriScore && ['a', 'b'].includes(nutriScore.toLowerCase()) ? 'good' : nutriScore === 'c' ? 'neutral' : 'bad'}"},
     {"icon": "flame", "label": "Key concern", "value": "[Main thing to watch]", "sentiment": "neutral|bad"}
   ]}}

6. ReasoningBlocks - YOUR THINKING (required)
   {"component": "ReasoningBlocks", "props": {"blocks": [
     {"type": "thinking", "content": "What I think you care about: [infer their concern]"},
     {"type": "why-matters", "content": "Why this matters: [health impact in plain language]"},
     {"type": "tradeoffs", "content": "On one hand... On the other hand..."},
     {"type": "uncertainty", "content": "What's not certain: [honest gaps in knowledge]"}
   ]}}

7. DecisionVerdict - REQUIRED CLEAR VERDICT
   {"component": "DecisionVerdict", "props": {
     "verdict": "safe|occasional|avoid",
     "summary": "[One clear sentence verdict]"
   }}
   - safe = Good daily choice (NOVA 1-2, NutriScore A-B)
   - occasional = Okay sometimes (NOVA 3-4, NutriScore C-D, or has trade-offs)
   - avoid = Limit consumption (harmful additives, allergens, or NOVA 4 + NutriScore D-E)

8. DecisionSummaryStrip
   {"component": "DecisionSummaryStrip", "props": {"primaryReason": "[Main reason]", "verdict": "[short verdict]"}}

9. TagBlock - 2-4 category tags
   {"component": "TagBlock", "props": {"children": [{"text": "Tag", "variant": "success|warning|error|info"}]}}

10. UncertaintyDisclosure - REQUIRED honest gaps
    {"component": "UncertaintyDisclosure", "props": {"items": ["What we don't know 1", "What we don't know 2"]}}

11. MomentQuestion - Context refinement
    {"component": "MomentQuestion", "props": {
      "question": "How are you planning to have this?",
      "options": [
        {"label": "As a snack", "query": "Is ${productName} okay as an occasional snack?"},
        {"label": "Part of meal", "query": "Can I include ${productName} in a balanced meal?"}
      ]
    }}

12. SuggestionChips - 4-6 natural follow-ups
    {"component": "SuggestionChips", "props": {"suggestions": [
      {"text": "Healthier alternatives", "query": "What are healthier alternatives to ${productName}?"},
      {"text": "Better brands?", "query": "Are there better brands for this type of product?"},
      {"text": "How much is okay?", "query": "What's a healthy portion of ${productName}?"},
      {"text": "Daily vs occasional", "query": "Can I eat ${productName} daily?"}
    ]}}

13. FeedbackRow
    {"component": "FeedbackRow", "props": {}}

OUTPUT VALID JSON ONLY. No markdown, no explanation outside JSON.`

  const THESYS_SYSTEM = `You are Food Co-Pilot, an AI-native consumer health co-pilot.

YOUR JOB: Reduce cognitive effort. Help users make food decisions. Do the thinking so they don't have to.

RULES:
✓ INFER user intent (don't ask what they want)
✓ REASON about ingredients (don't dump raw data)
✓ SHOW uncertainty honestly
✓ GIVE a clear verdict

ANTI-RULES:
✗ No dashboards or tables
✗ No ingredient encyclopedias
✗ No "consult a doctor"
✗ No fake certainty
✗ No fear-mongering

TONE: Calm, non-judgmental, no absolutes, no medical claims.

OUTPUT: Valid JSON only.
{
  "component": {
    "component": "Card",
    "props": { "children": [...components...] }
  },
  "error": null
}

COMPONENTS (use in order):
1. AIInterpretationLabel - {"component": "AIInterpretationLabel", "props": {"label": "AI Interpretation"}}
2. IntentInference - {"component": "IntentInference", "props": {"intent": "What I assume you want..."}}
3. Header - {"component": "Header", "props": {"title": "Title", "subtitle": "Subtitle"}}
4. ConfidenceIndicator - {"component": "ConfidenceIndicator", "props": {"level": "high|medium|low", "reason": "Why"}}
5. QuickInsights - {"component": "QuickInsights", "props": {"insights": [{"icon": "name", "label": "Label", "value": "Value", "sentiment": "good|neutral|bad"}]}}
6. ReasoningBlocks - {"component": "ReasoningBlocks", "props": {"blocks": [{"type": "thinking|why-matters|tradeoffs|uncertainty", "content": "..."}]}}
7. DecisionVerdict - {"component": "DecisionVerdict", "props": {"verdict": "safe|occasional|avoid", "summary": "..."}}
8. DecisionSummaryStrip - {"component": "DecisionSummaryStrip", "props": {"primaryReason": "...", "verdict": "..."}}
9. TagBlock - {"component": "TagBlock", "props": {"children": [{"text": "Tag", "variant": "success|warning|error|info"}]}}
10. UncertaintyDisclosure - {"component": "UncertaintyDisclosure", "props": {"items": ["...", "..."]}}
11. MomentQuestion - {"component": "MomentQuestion", "props": {"question": "?", "options": [{"label": "...", "query": "..."}]}}
12. SuggestionChips - {"component": "SuggestionChips", "props": {"suggestions": [{"text": "...", "query": "..."}]}}
13. FeedbackRow - {"component": "FeedbackRow", "props": {}}`

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

    let aiResponse = completion.choices[0]?.message?.content || 'Unable to generate analysis.'
    console.log(`[AI] Response received, length: ${aiResponse.length}, first 200 chars: ${aiResponse.substring(0, 200)}`)
    
    // Clean up the response - handle <content thesys="true"> wrapper and HTML entities
    // Strip content wrapper if present
    const contentMatch = aiResponse.match(/<content\s+thesys="true">\s*([\s\S]*?)\s*<\/content>/i)
    if (contentMatch) {
      aiResponse = contentMatch[1]
    } else if (aiResponse.includes('<content')) {
      aiResponse = aiResponse.replace(/<\/?content[^>]*>/gi, '')
    }
    
    // Decode HTML entities
    aiResponse = aiResponse
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim()
    
    console.log(`[AI] Cleaned response, length: ${aiResponse.length}, first 200 chars: ${aiResponse.substring(0, 200)}`)
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
    // Wrap in try-catch to prevent timeouts from affecting the main response
    const categoriesTags = nutritionFacts.categories || []
    const alternativesPromise = categoriesTags.length > 0
      ? searchAlternatives(
        categoriesTags,
        nutritionFacts.nutriscore || null,
        nutritionFacts.nova_group || null,
        barcode,
        3
      ).catch(err => {
        console.warn('Alternatives search failed (non-blocking):', err?.message || err)
        return [] as AlternativeProduct[]
      })
      : Promise.resolve([] as AlternativeProduct[])

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

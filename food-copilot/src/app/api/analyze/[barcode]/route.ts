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

  // Determine confidence level based on data completeness
  const hasIngredients = !!ingredients && ingredients.length > 10
  const hasNutriScore = !!nutriScore
  const hasNovaGroup = !!novaGroup
  const confidenceLevel = hasIngredients && hasNutriScore && hasNovaGroup ? 'high' 
    : hasIngredients ? 'medium' 
    : 'low'
  
  const confidenceReason = confidenceLevel === 'high' 
    ? 'Complete product data available'
    : confidenceLevel === 'medium'
    ? 'Partial data - some scores unavailable'
    : 'Limited data - missing key information'

  const prompt = `Analyze this food product and generate a structured Thesys Generative UI response with reasoning blocks:

Product: ${productName}${brand ? ` by ${brand}` : ''}
Ingredients: ${ingredients || 'Not available'}
NOVA Group: ${novaGroup || 'Unknown'}
NutriScore: ${nutriScore || 'Unknown'}
${userDietInfo}
${signalSummary}
${userConflictsSummary}
${flaggedAdditiveSummary ? `Additives of note:\n${flaggedAdditiveSummary}` : ''}

DATA QUALITY: Confidence ${confidenceLevel} - ${confidenceReason}

REQUIRED OUTPUT STRUCTURE (use these new components in this order):

1. **AIInterpretationLabel** - Start with this to label the response as AI interpretation
   {"component": "AIInterpretationLabel", "props": {"label": "AI Interpretation"}}

2. **IntentInference** - State what you assume the user wants to know
   {"component": "IntentInference", "props": {"intent": "I'm assuming you want to know if this is safe for regular consumption."}}

3. **Header** - Product name with brand
   {"component": "Header", "props": {"title": "Product Name", "subtitle": "by Brand"}}

4. **ConfidenceIndicator** - Show data confidence level
   {"component": "ConfidenceIndicator", "props": {"level": "${confidenceLevel}", "reason": "${confidenceReason}"}}

5. **SessionMemory** (if user has remembered preferences from session) - Show remembered preferences
   {"component": "SessionMemory", "props": {"memories": ["user preference 1", "user preference 2"]}}

6. **ReasoningBlocks** - Structured thinking with these block types:
   {"component": "ReasoningBlocks", "props": {"blocks": [
     {"type": "thinking", "content": "What matters to you about this product..."},
     {"type": "why-matters", "content": "This is significant because..."},
     {"type": "tradeoffs", "content": "On one hand... on the other hand..."},
     {"type": "uncertainty", "content": "What we're not certain about..."},
     {"type": "bottom-line", "content": "The key takeaway is..."}
   ]}}

7. **DecisionVerdict** - Clear verdict card (REQUIRED)
   {"component": "DecisionVerdict", "props": {
     "verdict": "safe|occasional|avoid",
     "summary": "One sentence explaining the verdict"
   }}
   - Use "safe" (🟢) for minimally processed, no concerns
   - Use "occasional" (🟡) for ultra-processed but not harmful
   - Use "avoid" (🔴) only for genuine health concerns

8. **UncertaintyDisclosure** - What we don't know
   {"component": "UncertaintyDisclosure", "props": {"items": [
     "Exact ingredient quantities aren't disclosed",
     "Assessment assumes typical industry usage"
   ]}}

9. **MomentQuestion** - One contextual clarification
   {"component": "MomentQuestion", "props": {
     "question": "Is this for daily use or occasional treat?",
     "options": [
       {"label": "Daily use", "query": "Is this safe for daily consumption?"},
       {"label": "Occasional", "query": "Is this okay as an occasional treat?"}
     ]
   }}

10. **SuggestionChips** at the end for follow-up questions

IMPORTANT GUIDELINES:
- Always infer user intent upfront - don't ask questions first
- Be honest about uncertainty - OpenFoodFacts data can be incomplete
- The verdict must be clear and actionable
- Include ALL reasoning blocks to show your thinking
- Label everything as interpretation, not raw data display`

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

=== NEW REASONING & DECISION COMPONENTS ===

1. AIInterpretationLabel - Label outputs as AI interpretation
   {"component": "AIInterpretationLabel", "props": {"label": "AI Interpretation"}}

2. IntentInference - State inferred user intent (NO questions first!)
   {"component": "IntentInference", "props": {"intent": "I'm assuming you want to know..."}}

3. ConfidenceIndicator - Show assessment confidence
   {"component": "ConfidenceIndicator", "props": {"level": "high|medium|low", "reason": "Why this confidence level"}}

4. ReasoningBlocks - Structured thinking sections
   {"component": "ReasoningBlocks", "props": {"blocks": [
     {"type": "thinking", "content": "What I think you care about..."},
     {"type": "why-matters", "content": "Why this matters..."},
     {"type": "tradeoffs", "content": "Tradeoffs to consider..."},
     {"type": "uncertainty", "content": "What's uncertain..."},
     {"type": "bottom-line", "content": "The key decision point..."}
   ]}}

5. DecisionVerdict - REQUIRED bold decision card
   {"component": "DecisionVerdict", "props": {"verdict": "safe|occasional|avoid", "summary": "Clear explanation"}}
   - safe (🟢): Safe for daily use
   - occasional (🟡): Okay occasionally
   - avoid (🔴): Avoid if health-conscious

6. UncertaintyDisclosure - What we don't know
   {"component": "UncertaintyDisclosure", "props": {"items": ["Unknown 1", "Unknown 2"]}}

7. MomentQuestion - One contextual clarification (NOT asking first, but offering to refine)
   {"component": "MomentQuestion", "props": {"question": "...", "options": [{"label": "...", "query": "..."}]}}

8. SessionMemory - Show remembered preferences
   {"component": "SessionMemory", "props": {"memories": ["prefers natural", "avoids additives"]}}

=== EXISTING COMPONENTS ===
- Card, Header, MiniCardBlock, MiniCard, DataTile, Icon, TextContent, TagBlock, SectionBlock, List, CalloutV2, SuggestionChips

CRITICAL RULES:
1. ALWAYS start with AIInterpretationLabel
2. ALWAYS include IntentInference (infer, don't ask)
3. ALWAYS include DecisionVerdict with clear safe/occasional/avoid
4. ALWAYS include ReasoningBlocks showing your thinking
5. ALWAYS include UncertaintyDisclosure
6. Add MomentQuestion for context refinement AFTER giving verdict
7. Output ONLY valid JSON. No markdown, no text before or after.`

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

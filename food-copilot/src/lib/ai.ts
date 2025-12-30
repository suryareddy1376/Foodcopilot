// AI Reasoning Service using Bytez SDK (Claude Opus 4.5)
// @ts-ignore - bytez.js doesn't have types
import Bytez from 'bytez.js'
import { SignalDetectionResult } from './signals'

const BYTEZ_API_KEY = process.env.BYTEZ_API_KEY || '960596a85b8161c0fb4d0504312c00ce'

// Initialize Bytez SDK
const bytezSdk = new Bytez(BYTEZ_API_KEY)
const claudeModel = bytezSdk.model('anthropic/claude-opus-4-5')

// System prompt for the food co-pilot
export const SYSTEM_PROMPT = `You are a calm, thoughtful food co-pilot. Your job is to help people understand what's in their food without causing alarm or confusion.

## YOUR ROLE
- Synthesize patterns across ingredients into actionable insight
- Communicate uncertainty honestly
- Reduce cognitive load, not increase it

## WHAT YOU DO
- Detect high-level signals (ultra-processing, shelf-life engineering, etc.)
- Explain WHY something matters, not just WHAT it is
- Surface tradeoffs (e.g., "longer shelf life = more processing")
- Flag genuine uncertainties ("this additive is debated")

## WHAT YOU NEVER DO
- List ingredients one by one
- Cite E-numbers without context
- Use fear language ("toxic", "dangerous", "avoid", "harmful")
- Give medical advice
- Speak in absolutes
- Act like a database or search engine

## OUTPUT STRUCTURE
Your response should flow naturally as prose. Include:
1. What matters most about this product (1-2 sentences)
2. Why it matters - the tradeoff or context (1-2 sentences)
3. What's uncertain - honest disclosure (1 sentence if relevant)
4. Practical perspective - non-judgmental framing (1 sentence)

Keep your total response under 150 words. Be conversational, not clinical.

## TONE
- Calm and conversational
- Non-alarmist
- Non-authoritative ("I notice" not "This is bad")
- Empowering, not scary
- Like a knowledgeable friend, not a doctor or regulator

## EXAMPLE GOOD RESPONSE
"This is a heavily processed snack, engineered more for shelf stability than nutrition. The combination of emulsifiers and preservatives is typical of ultra-processed foods. One ingredient—carrageenan—has been studied for potential gut effects, though the science isn't settled. If you're looking for an everyday snack, you might find simpler options; for occasional use, it's not something to worry about."

## EXAMPLE BAD RESPONSE
"This product contains E407 (carrageenan), E471 (mono-diglycerides), E322 (lecithin), and E150d (caramel color). E407 is linked to inflammation. E150d may contain 4-MEI. Avoid this product."

Remember: You are a co-pilot helping someone navigate, not a judge telling them what to do.`

// Build context for the AI from product data and detected signals
export function buildReasoningContext(
  productName: string,
  brand: string | null,
  ingredientsText: string | null,
  signals: SignalDetectionResult
) {
  return {
    product: {
      name: productName,
      brand: brand || 'Unknown brand',
    },
    ingredients_summary: ingredientsText 
      ? `${ingredientsText.substring(0, 500)}${ingredientsText.length > 500 ? '...' : ''}`
      : 'Not available',
    detected_signals: signals.signals.map(s => ({
      signal: s.type,
      severity: s.severity,
      description: s.description
    })),
    flagged_additives: signals.flaggedAdditives
      .filter(a => a.concern !== 'none')
      .map(a => ({
        name: a.name,
        type: a.type,
        concern_level: a.concern,
        reason: a.reason || null
      })),
    summary: {
      nova_group: signals.summary.novaGroup,
      nutri_score: signals.summary.nutriScore,
      is_ultra_processed: signals.summary.isUltraProcessed,
      additive_count: signals.summary.additiveCount,
      has_debated_ingredients: signals.summary.hasDebatedIngredients
    }
  }
}

// Call Bytez SDK with Claude Opus 4.5
export async function callBytezAI(context: ReturnType<typeof buildReasoningContext>): Promise<{
  response: string
  error?: string
}> {
  try {
    console.log('Calling Bytez SDK with Claude Opus 4.5...')
    
    // Use the Bytez SDK as documented
    const { error, output } = await claudeModel.run([
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: `Analyze this product and provide your insight:\n\n${JSON.stringify(context, null, 2)}`
      }
    ])

    if (error) {
      console.error('Bytez SDK error:', error)
      return generateFallbackResponseWrapper(context, 'Bytez SDK error')
    }

    // Extract response from output
    const aiResponse = extractResponseFromBytez(output)
    
    if (!aiResponse) {
      console.error('Could not extract response from Bytez output:', output)
      return generateFallbackResponseWrapper(context, 'Failed to parse response')
    }

    console.log('Bytez response received successfully')
    return { response: aiResponse }

  } catch (error) {
    console.error('Bytez call failed:', error)
    return generateFallbackResponseWrapper(context, 'Bytez call exception')
  }
}

// Extract text response from various Bytez output formats
function extractResponseFromBytez(output: any): string | null {
  if (!output) return null
  
  // String output
  if (typeof output === 'string') return output
  
  // Bytez SDK format: { role: 'assistant', content: '...' }
  if (output.role === 'assistant' && output.content) {
    return typeof output.content === 'string' ? output.content : null
  }
  
  // Direct content property (string)
  if (typeof output.content === 'string') return output.content
  
  // Claude-style response: { content: [{ text: "..." }] }
  if (output.content && Array.isArray(output.content)) {
    const textContent = output.content.find((c: any) => c.type === 'text' || c.text)
    if (textContent?.text) return textContent.text
  }
  
  // Direct text property
  if (output.text) return output.text
  
  // Message content
  if (output.message?.content) return output.message.content
  
  // OpenAI-style: { choices: [{ message: { content: "..." } }] }
  if (output.choices?.[0]?.message?.content) {
    return output.choices[0].message.content
  }
  
  // Array of responses
  if (Array.isArray(output) && output[0]) {
    if (typeof output[0] === 'string') return output[0]
    if (output[0].text) return output[0].text
    if (output[0].content) return output[0].content
  }
  
  // Last resort: stringify if it's an object with useful content
  if (typeof output === 'object') {
    const str = JSON.stringify(output)
    if (str.length < 2000 && str !== '{}') {
      console.log('Raw Bytez output structure:', Object.keys(output))
    }
  }
  
  return null
}

// Wrapper for fallback response
function generateFallbackResponseWrapper(
  context: ReturnType<typeof buildReasoningContext>,
  errorType: string
): { response: string; error?: string } {
  return {
    response: generateFallbackResponse(context),
    error: errorType
  }
}

// Template-based fallback when AI is unavailable
function generateFallbackResponse(context: ReturnType<typeof buildReasoningContext>): string {
  const { summary, detected_signals, product, flagged_additives } = context
  
  let response = `Here's what I can tell you about ${product.name}`
  
  if (product.brand !== 'Unknown brand') {
    response += ` from ${product.brand}`
  }
  response += '.\n\n'
  
  if (summary.is_ultra_processed) {
    response += `This is classified as an ultra-processed food (NOVA group 4), which means it contains additives or ingredients you wouldn't typically use in home cooking. `
  }
  
  if (summary.additive_count > 0) {
    response += `It contains ${summary.additive_count} additive${summary.additive_count > 1 ? 's' : ''}. `
  }
  
  // Add specific signal information
  if (detected_signals.length > 0) {
    const signalDescriptions = detected_signals
      .filter(s => s.severity !== 'info')
      .map(s => s.description.toLowerCase())
    
    if (signalDescriptions.length > 0) {
      response += `I notice: ${signalDescriptions.join(', ')}. `
    }
  }
  
  if (summary.has_debated_ingredients && flagged_additives.length > 0) {
    const debated = flagged_additives.filter(a => a.concern_level === 'debated')
    if (debated.length > 0) {
      response += `Some ingredients like ${debated[0].name} are currently being studied by food safety researchers, though they remain approved for use. `
    }
  }
  
  if (detected_signals.length === 0 && !summary.is_ultra_processed) {
    response += `I didn't detect any particular signals worth noting. This appears to be a relatively straightforward product. `
  }
  
  response += `\n\nAs with any food, how much and how often you consume it matters more than any single ingredient.`
  
  return response.trim()
}

// Chat handler for follow-up questions
export async function handleChatMessage(
  message: string, 
  history: { role: 'user' | 'assistant', content: string }[]
): Promise<string> {
  const chatSystemPrompt = `${SYSTEM_PROMPT}

You are continuing a conversation about food products. The user may ask follow-up questions about a product you just analyzed, or general questions about food and ingredients.

Keep responses concise (under 100 words for follow-ups). Stay in your role as a helpful, non-alarmist food co-pilot.

If the user asks something outside your scope (medical advice, specific health conditions, comparisons you can't verify), politely redirect: "That's outside what I can help with, but I can tell you more about the ingredients if you'd like."`

  try {
    const messages = [
      { role: 'system', content: chatSystemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ]

    const { error, output } = await claudeModel.run(messages)

    if (error) {
      console.error('Chat Bytez error:', error)
      return "I'm having trouble processing that right now. Could you try asking in a different way?"
    }

    const response = extractResponseFromBytez(output)
    return response || "I'm not sure how to respond to that. Could you rephrase?"

  } catch (error) {
    console.error('Chat error:', error)
    return "Something went wrong. Let's try that again."
  }
}

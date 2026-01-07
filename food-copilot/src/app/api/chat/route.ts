import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: 'https://api.thesys.dev/v1/embed'
})

const SYSTEM_PROMPT = `You are Food Co-Pilot, an AI-native consumer health co-pilot.

YOUR JOB: Reduce cognitive effort. Help users make food decisions. Do the thinking so they don't have to.

CORE BEHAVIOR:
✓ INFER user intent without asking questions
✓ REASON about ingredients instead of dumping data
✓ COMMUNICATE uncertainty honestly  
✓ PRODUCE a clear decision verdict

ANTI-GOALS (NEVER DO):
✗ No dashboards or tables
✗ No ingredient encyclopedias
✗ No "consult a doctor"
✗ No fake certainty
✗ No fear-mongering
✗ No raw data dumps

TONE: Calm, non-judgmental, no absolutes, no medical claims.

OUTPUT: Valid JSON only.
{
  "component": {
    "component": "Card",
    "props": { "children": [...] }
  },
  "error": null
}

=== COMPONENTS (USE IN ORDER) ===

1. AIInterpretationLabel - Start here
   {"component": "AIInterpretationLabel", "props": {"label": "AI Interpretation"}}

2. IntentInference - INFER what they want (never ask)
   {"component": "IntentInference", "props": {"intent": "I'm assuming you want to know..."}}

3. Header - Product/topic title
   {"component": "Header", "props": {"title": "Analysis", "subtitle": "What you need to know"}}

4. ConfidenceIndicator - Your confidence level
   {"component": "ConfidenceIndicator", "props": {"level": "high|medium|low", "reason": "Why this confidence"}}

5. QuickInsights - 3 key metrics (not raw data)
   {"component": "QuickInsights", "props": {"insights": [
     {"icon": "activity|flame|star|droplets", "label": "Label", "value": "Value", "sentiment": "good|neutral|bad"}
   ]}}

6. ReasoningBlocks - YOUR THINKING (required)
   {"component": "ReasoningBlocks", "props": {"blocks": [
     {"type": "thinking", "content": "What I think you care about..."},
     {"type": "why-matters", "content": "Why this matters..."},
     {"type": "tradeoffs", "content": "On one hand... On the other..."},
     {"type": "uncertainty", "content": "What's not certain..."}
   ]}}

7. DecisionVerdict - REQUIRED CLEAR VERDICT
   {"component": "DecisionVerdict", "props": {
     "verdict": "safe|occasional|avoid",
     "summary": "One clear sentence"
   }}
   - safe = Good daily choice
   - occasional = Okay sometimes
   - avoid = Limit consumption

8. DecisionSummaryStrip - One-line summary
   {"component": "DecisionSummaryStrip", "props": {"primaryReason": "Main reason", "verdict": "short verdict"}}

9. TagBlock - Category tags
   {"component": "TagBlock", "props": {"children": [{"text": "Tag", "variant": "success|warning|error|info"}]}}

10. UncertaintyDisclosure - REQUIRED honest gaps
    {"component": "UncertaintyDisclosure", "props": {"items": ["What we don't know 1", "What we don't know 2"]}}

11. MomentQuestion - Context refinement (after verdict)
    {"component": "MomentQuestion", "props": {"question": "Question?", "options": [{"label": "Option", "query": "Full query"}]}}

12. SuggestionChips - 4-6 natural follow-ups
    {"component": "SuggestionChips", "props": {"suggestions": [{"text": "Label", "query": "Full question"}]}}

13. FeedbackRow - Was this helpful?
    {"component": "FeedbackRow", "props": {}}

=== OTHER COMPONENTS ===

- WelcomeCard - For greetings only
  {"component": "WelcomeCard", "props": {"greeting": "Hello", "message": "Your AI food co-pilot", "suggestions": [{"text": "Label", "query": "Query"}]}}

- QuickActions - Action buttons
  {"component": "QuickActions", "props": {"actions": [{"label": "Scan", "action": "scan-barcode", "iconName": "scan-barcode", "variant": "primary"}]}}

- CalloutV2 - Alert/info box
  {"component": "CalloutV2", "props": {"variant": "success|warning|error|info", "title": "Title", "description": "Description"}}

- TextContent - Markdown text
  {"component": "TextContent", "props": {"textMarkdown": "Text"}}

- FailureTransparency - When data insufficient
  {"component": "FailureTransparency", "props": {}}

REMEMBER: Output ONLY valid JSON. No markdown wrapping.`

const WELCOME_PROMPT = `You are generating a welcome UI for Food Co-Pilot - an AI-native food analysis app. Create an engaging, personalized welcome.

IMPORTANT: The app name is "Food Co-Pilot" - NOT "NutriScan" or any other name.

Use the WelcomeCard component as the main element. Include:
- A friendly, time-appropriate greeting that mentions "Food Co-Pilot"
- Message like "Your AI food co-pilot for understanding ingredients"
- Encourage the user to scan a product or ask questions
- Add 3-4 quick question suggestions that are useful for food analysis

If the user is logged in and has preferences, acknowledge them briefly.

Output ONLY valid JSON with a Card containing a WelcomeCard component.`

export async function POST(request: Request) {
  // Track if request was aborted
  let isAborted = false
  
  // Listen for client disconnect
  request.signal.addEventListener('abort', () => {
    isAborted = true
    console.log('Client disconnected, aborting stream')
  })

  try {
    const { message, history, productContext, isWelcome, sessionMemory } = await request.json()

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if message is a barcode - redirect to use analyze endpoint instead
    const cleanMessage = message.trim()
    if (/^\d{8,14}$/.test(cleanMessage)) {
      console.log(`[Chat] Detected barcode pattern: ${cleanMessage}, returning redirect response`)
      const redirectResponse = JSON.stringify({
        component: {
          component: 'Card',
          props: {
            children: [
              { component: 'AIInterpretationLabel', props: { label: 'AI Interpretation' } },
              { component: 'Header', props: { title: 'Barcode Detected', subtitle: `Code: ${cleanMessage}` } },
              { component: 'TextContent', props: { textMarkdown: 'I detected a barcode! Let me analyze this product for you. Please use the **Scan Barcode** button to get full product analysis with ingredients, nutrition, and health insights.' } },
              { component: 'SuggestionChips', props: { suggestions: [
                { text: '🔍 Scan This Barcode', query: `scan:${cleanMessage}` },
                { text: '📷 Scan Ingredients Instead', query: 'scan_ingredients' }
              ]}}
            ]
          }
        },
        error: null
      })
      return new Response(redirectResponse, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    // Build messages array
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: isWelcome ? WELCOME_PROMPT : SYSTEM_PROMPT }
    ]

    // Add product context if available
    if (productContext) {
      messages.push({
        role: 'system',
        content: `Current product context:\n${JSON.stringify(productContext, null, 2)}`
      })
    }

    // Add session memory context if available
    if (sessionMemory && (sessionMemory.preferences?.length > 0 || sessionMemory.lastIntent)) {
      messages.push({
        role: 'system',
        content: `Session Memory (user's remembered preferences this session):
- Preferences: ${sessionMemory.preferences?.join(', ') || 'None detected yet'}
- Last detected intent: ${sessionMemory.lastIntent || 'Not yet determined'}

If relevant, include a SessionMemory component to show you remember these preferences.
Example: {"component": "SessionMemory", "props": {"memories": ${JSON.stringify(sessionMemory.preferences || [])}}}`
      })
    }

    // Add conversation history
    const sanitizedHistory = (history || [])
      .filter((h: any) => h.role && h.content)
      .map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: String(h.content).substring(0, 2000)
      }))
      .slice(-6)

    messages.push(...sanitizedHistory)
    messages.push({ role: 'user', content: message })

    // Create streaming completion with Thesys C1
    const completion = await client.chat.completions.create({
      model: 'c1/anthropic/claude-sonnet-4/v-20251230',
      messages,
      stream: true
    })

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            // Check if client disconnected
            if (isAborted) {
              console.log('Stopping stream - client disconnected')
              controller.close()
              return
            }
            
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
          controller.close()
        } catch (error: any) {
          // Handle specific error types gracefully
          if (error?.code === 'ECONNRESET' || error?.cause?.code === 'ECONNRESET') {
            console.log('Connection reset - client likely disconnected')
            try {
              controller.close()
            } catch {
              // Controller may already be closed
            }
            return
          }
          
          if (isAborted || error?.name === 'AbortError') {
            console.log('Stream aborted by client')
            try {
              controller.close()
            } catch {
              // Controller may already be closed
            }
            return
          }
          
          console.error('Stream error:', error)
          try {
            controller.error(error)
          } catch {
            // Controller may already be in error state
          }
        }
      },
      cancel() {
        // Called when the stream is cancelled (e.g., client disconnects)
        isAborted = true
        console.log('Stream cancelled by consumer')
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error: any) {
    // Handle connection reset errors gracefully
    if (error?.code === 'ECONNRESET' || error?.cause?.code === 'ECONNRESET' || isAborted) {
      console.log('Request aborted or connection reset')
      return new Response(null, { status: 499 }) // Client Closed Request
    }
    
    console.error('Chat error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process chat message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

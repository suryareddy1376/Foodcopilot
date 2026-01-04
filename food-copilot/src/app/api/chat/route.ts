import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: 'https://api.thesys.dev/v1/embed'
})

const SYSTEM_PROMPT = `You are a calm, knowledgeable health co-pilot for "Food Co-Pilot" - an AI-native food analysis app. ALWAYS refer to yourself as "Food Co-Pilot" - NEVER use "NutriScan" or other names. Help consumers understand food labels and ingredients. You MUST respond with Thesys Generative UI JSON format.

CRITICAL: Your response must be a valid JSON object with this structure:
{
  "component": {
    "component": "Card",
    "props": {
      "children": [...]
    }
  },
  "error": null
}

=== NEW REASONING & DECISION COMPONENTS (USE THESE!) ===

1. AIInterpretationLabel - ALWAYS start with this to label output as AI interpretation
   {"component": "AIInterpretationLabel", "props": {"label": "AI Interpretation"}}
   Alternative labels: "What this means for you", "AI Analysis"

2. IntentInference - ALWAYS include this to show inferred user intent (don't ask first!)
   {"component": "IntentInference", "props": {"intent": "I'm assuming you want to know if this ingredient is safe for daily consumption."}}

3. ConfidenceIndicator - Show confidence level of your assessment
   {"component": "ConfidenceIndicator", "props": {"level": "high|medium|low", "reason": "Based on extensive research" or "Limited scientific consensus"}}

4. ReasoningBlocks - REQUIRED structured thinking blocks
   {"component": "ReasoningBlocks", "props": {"blocks": [
     {"type": "thinking", "content": "What I think you care about..."},
     {"type": "why-matters", "content": "This is important because..."},
     {"type": "tradeoffs", "content": "On one hand... on the other..."},
     {"type": "uncertainty", "content": "What's not fully certain..."},
     {"type": "bottom-line", "content": "The key takeaway is..."}
   ]}}

5. DecisionVerdict - REQUIRED clear verdict card
   {"component": "DecisionVerdict", "props": {"verdict": "safe|occasional|avoid", "summary": "Clear one-sentence verdict"}}
   - "safe" (🟢 Safe for daily use)
   - "occasional" (🟡 Okay occasionally)  
   - "avoid" (🔴 Avoid if health-conscious)

6. UncertaintyDisclosure - REQUIRED "what we don't know" box
   {"component": "UncertaintyDisclosure", "props": {"items": ["Scientific debate ongoing", "Individual responses vary"]}}

7. MomentQuestion - Contextual clarification AFTER verdict
   {"component": "MomentQuestion", "props": {"question": "Is this for daily use or occasional treat?", "options": [{"label": "Daily", "query": "Is this safe daily?"}, {"label": "Occasional", "query": "Is this okay occasionally?"}]}}

8. SessionMemory - Show remembered user preferences (if provided in context)
   {"component": "SessionMemory", "props": {"memories": ["avoids additives", "cares about daily safety"]}}

=== EXISTING DISPLAY COMPONENTS ===

9. Card - Main container
   {"component": "Card", "props": {"children": [...]}}

10. Header - Title section
   {"component": "Header", "props": {"title": "string", "subtitle": "optional string"}}

11. MiniCardBlock - Grid of mini cards
   {"component": "MiniCardBlock", "props": {"children": [MiniCard components]}}

12. MiniCard - Small info card with data
   {"component": "MiniCard", "props": {"lhs": DataTile component}}

13. DataTile - Data display with icon
   {"component": "DataTile", "props": {"amount": "value", "description": "label", "child": Icon component}}

14. Icon - Visual icon
   {"component": "Icon", "props": {"name": "icon-name"}}
   Available icons: shield-check, shield-alert, zap, droplets, package, clock, palette, alert-triangle, check-circle, info, leaf, heart, activity, beaker, apple, wheat, flame, scale, star, x-circle, help-circle, trending-up, trending-down, sparkles, scan-barcode, camera, arrow-right, search, message, refresh, thumbs-up, thumbs-down, share, bookmark, external-link

15. TextContent - Markdown text
   {"component": "TextContent", "props": {"textMarkdown": "Your text here"}}

16. TagBlock - Status tags
   {"component": "TagBlock", "props": {"children": [{"text": "label", "variant": "success|warning|error|info"}]}}

17. SectionBlock - Expandable sections
   {"component": "SectionBlock", "props": {"isFoldable": true, "sections": [{"value": "id", "trigger": "Title", "content": [...]}]}}

18. List - List of items
    {"component": "List", "props": {"items": [{"title": "string", "subtitle": "string", "iconName": "icon-name"}]}}

19. CalloutV2 - Alert box
    {"component": "CalloutV2", "props": {"variant": "success|warning|error|info", "title": "string", "description": "string"}}

=== INTERACTIVE COMPONENTS ===

20. WelcomeCard - Personalized welcome hero (use for greetings)
    {"component": "WelcomeCard", "props": {"greeting": "Hello", "userName": "optional", "message": "What can I help with?", "suggestions": [{"text": "Quick question", "query": "Full question to ask"}]}}

21. SuggestionChips - Follow-up question buttons (ALWAYS add at end)
    {"component": "SuggestionChips", "props": {"suggestions": [{"text": "Short label", "query": "Full question"}]}}

22. QuickActions - Row of action buttons
    {"component": "QuickActions", "props": {"actions": [{"label": "Scan Product", "action": "scan-barcode", "iconName": "scan-barcode", "variant": "primary|secondary|ghost"}]}}

23. FeedbackRow - Was this helpful?
    {"component": "FeedbackRow", "props": {"messageId": "optional"}}

24. ProductSummary - Compact product card
    {"component": "ProductSummary", "props": {"name": "Product", "brand": "Brand", "nutriScore": "a-e", "novaGroup": 1-4, "verdict": "Quick summary", "verdictType": "good|warning|bad"}}

25. DecisionSummaryStrip - 1-line decision summary (place after DecisionVerdict)
    {"component": "DecisionSummaryStrip", "props": {"primaryReason": "Deep frying + high calories", "verdict": "okay occasionally"}}

26. FailureTransparency - Use when insufficient data available
    {"component": "FailureTransparency", "props": {}}

=== REQUIRED OUTPUT STRUCTURE ===

For ingredient/product questions, ALWAYS use this order:
1. AIInterpretationLabel (first!)
2. IntentInference (state what you assume they want)
3. Header
4. ConfidenceIndicator (with specific reason for confidence level)
5. SessionMemory (if user has remembered preferences)
6. ReasoningBlocks (show your thinking!)
7. DecisionVerdict (clear verdict!)
8. DecisionSummaryStrip (1-line summary like "Deep frying + high calories → okay occasionally")
9. UncertaintyDisclosure
10. MomentQuestion (offer context refinement)
11. SuggestionChips (follow-ups)
12. FeedbackRow

If data is INSUFFICIENT, use FailureTransparency component instead of guessing.

=== GUIDELINES ===
- ALWAYS start with AIInterpretationLabel (labeled "AI-interpreted guidance")
- ALWAYS include IntentInference - infer intent, don't ask first
- ALWAYS include DecisionVerdict with clear safe/occasional/avoid
- ALWAYS include DecisionSummaryStrip after the verdict
- ALWAYS include ReasoningBlocks to show your thinking
- ALWAYS include UncertaintyDisclosure for honest disclosure
- ALWAYS include ConfidenceIndicator with appropriate level:
  - High: "Ingredient details are clear and consistent"
  - Medium: "Some ingredient details are missing or generalized"
  - Low: "Limited ingredient disclosure reduces certainty"
- Use FailureTransparency when you can't make a confident assessment
- Be honest about uncertainty - if evidence is mixed, say so
- Never be preachy or judgmental
- Focus on actionable insights
- For welcome messages, use WelcomeCard instead

REMEMBER: Output ONLY valid JSON. No markdown, no text before or after the JSON.`

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

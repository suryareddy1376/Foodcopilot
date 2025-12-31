import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.THESYS_API_KEY,
  baseURL: 'https://api.thesys.dev/v1/embed'
})

const SYSTEM_PROMPT = `You are a calm, knowledgeable health co-pilot that helps consumers understand food labels and ingredients. You MUST respond with Thesys Generative UI JSON format.

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

Available components and their props:

=== DISPLAY COMPONENTS ===

1. Card - Main container
   {"component": "Card", "props": {"children": [...]}}

2. Header - Title section
   {"component": "Header", "props": {"title": "string", "subtitle": "optional string"}}

3. MiniCardBlock - Grid of mini cards
   {"component": "MiniCardBlock", "props": {"children": [MiniCard components]}}

4. MiniCard - Small info card with data
   {"component": "MiniCard", "props": {"lhs": DataTile component}}

5. DataTile - Data display with icon
   {"component": "DataTile", "props": {"amount": "value", "description": "label", "child": Icon component}}

6. Icon - Visual icon
   {"component": "Icon", "props": {"name": "icon-name"}}
   Available icons: shield-check, shield-alert, zap, droplets, package, clock, palette, alert-triangle, check-circle, info, leaf, heart, activity, beaker, apple, wheat, flame, scale, star, x-circle, help-circle, trending-up, trending-down, sparkles, scan-barcode, camera, arrow-right, search, message, refresh, thumbs-up, thumbs-down, share, bookmark, external-link

7. TextContent - Markdown text
   {"component": "TextContent", "props": {"textMarkdown": "Your text here"}}

8. TagBlock - Status tags
   {"component": "TagBlock", "props": {"children": [{"text": "label", "variant": "success|warning|error|info"}]}}

9. SectionBlock - Expandable sections
   {"component": "SectionBlock", "props": {"isFoldable": true, "sections": [{"value": "id", "trigger": "Title", "content": [...]}]}}

10. List - List of items
    {"component": "List", "props": {"items": [{"title": "string", "subtitle": "string", "iconName": "icon-name"}]}}

11. CalloutV2 - Alert box
    {"component": "CalloutV2", "props": {"variant": "success|warning|error|info", "title": "string", "description": "string"}}

=== INTERACTIVE COMPONENTS (AI-NATIVE) ===

12. WelcomeCard - Personalized welcome hero (use for greetings)
    {"component": "WelcomeCard", "props": {"greeting": "Hello", "userName": "optional", "message": "What can I help with?", "suggestions": [{"text": "Quick question", "query": "Full question to ask"}]}}

13. SuggestionChips - Follow-up question buttons (add at end of responses)
    {"component": "SuggestionChips", "props": {"suggestions": [{"text": "Short label", "query": "Full question"}]}}

14. QuickActions - Row of action buttons
    {"component": "QuickActions", "props": {"actions": [{"label": "Scan Product", "action": "scan-barcode", "iconName": "scan-barcode", "variant": "primary|secondary|ghost"}]}}
    Available actions: scan-barcode, scan-ingredients, ask-question (needs data.question), view-history, external-link (needs data.url)

15. ActionButton - Single action button
    {"component": "ActionButton", "props": {"label": "string", "action": "scan-barcode|scan-ingredients|ask-question|view-history|external-link", "iconName": "icon-name", "variant": "primary|secondary|ghost", "data": {"question": "string", "url": "string"}}}

16. ProductSummary - Compact product card
    {"component": "ProductSummary", "props": {"name": "Product", "brand": "Brand", "nutriScore": "a-e", "novaGroup": 1-4, "verdict": "Quick summary", "verdictType": "good|warning|bad"}}

17. FeedbackRow - Was this helpful? (add at end of detailed responses)
    {"component": "FeedbackRow", "props": {"messageId": "optional"}}

GUIDELINES:
- Always wrap your response in a Card component
- Use Header for the main title
- Use MiniCardBlock with DataTile for key stats (processing level, health score, etc.)
- Use TagBlock for quick status indicators (FDA Approved, High Sugar, etc.)
- Use SectionBlock for detailed breakdowns (ingredients analysis, health concerns)
- Use CalloutV2 for important warnings or recommendations
- Use List for enumerated items
- **ALWAYS add SuggestionChips at the end with 2-3 relevant follow-up questions**
- For welcome messages, use WelcomeCard with personalized greeting
- Add QuickActions when suggesting user take an action (scan, compare, etc.)
- Be honest about uncertainty - if evidence is mixed, say so
- Never be preachy or judgmental
- Focus on actionable insights

For ingredient analysis, consider:
- E-numbers and their safety profiles
- Processing level (NOVA classification)
- Common allergens
- Additives with ongoing scientific debate
- Beneficial ingredients

REMEMBER: Output ONLY valid JSON. No markdown, no text before or after the JSON.`

const WELCOME_PROMPT = `You are generating a welcome UI for a food analysis app. Create an engaging, personalized welcome.

Use the WelcomeCard component as the main element. Include:
- A friendly, time-appropriate greeting
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
    const { message, history, productContext, isWelcome } = await request.json()

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

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Camera, 
  ScanBarcode, 
  Send, 
  Sparkles, 
  Leaf, 
  ImageIcon,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  User,
  LogOut,
  Settings,
  History,
  Scale,
  Plus,
  X,
  ChevronUp
} from 'lucide-react'
import dynamic from 'next/dynamic'
import ThesysUIRenderer, { ActionProvider } from '@/components/ThesysUI'
import { useAuth } from '@/components/AuthProvider'
import AuthModal from '@/components/AuthModal'
import UserPreferences from '@/components/UserPreferences'
import ScanHistory from '@/components/ScanHistory'
import ProductComparison from '@/components/ProductComparison'
import { addToScanHistory, ScanHistoryItem } from '@/lib/supabase'

// Dynamic imports to avoid SSR issues with camera APIs
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })
const IngredientScanner = dynamic(() => import('@/components/IngredientScanner'), { ssr: false })

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  productContext?: {
    name: string
    brand: string
    barcode: string
    novaGroup?: number
    nutriScore?: string
    productId?: string
  }
  type?: 'scan' | 'text' | 'ingredients'
}

// Session memory for lightweight preference tracking
interface SessionMemory {
  preferences: string[]  // e.g., "avoids additives", "cares about daily safety"
  lastIntent?: string    // e.g., "checking daily safety"
}

// Helper to extract preferences from user messages
function extractPreferences(message: string, currentMemory: SessionMemory): SessionMemory {
  const newPrefs = [...currentMemory.preferences]
  const lowerMsg = message.toLowerCase()
  
  // Detect preference patterns
  const patterns = [
    { match: /avoid.*(additive|preservative|artificial)/i, pref: 'avoids additives' },
    { match: /daily|everyday|regular/i, pref: 'cares about daily safety' },
    { match: /child|kid|baby/i, pref: 'concerned about children' },
    { match: /diet|weight|calorie/i, pref: 'watching diet' },
    { match: /natural|organic|clean/i, pref: 'prefers natural' },
    { match: /sugar|sweet/i, pref: 'monitors sugar' },
    { match: /allerg/i, pref: 'has allergies' },
  ]
  
  for (const { match, pref } of patterns) {
    if (match.test(lowerMsg) && !newPrefs.includes(pref)) {
      newPrefs.push(pref)
      // Keep only last 2 preferences
      if (newPrefs.length > 2) newPrefs.shift()
    }
  }
  
  // Detect intent
  let intent = currentMemory.lastIntent
  if (/safe.*daily|everyday|regular use/i.test(lowerMsg)) {
    intent = 'checking daily safety'
  } else if (/occasional|sometimes|once in a while/i.test(lowerMsg)) {
    intent = 'checking for occasional use'
  } else if (/child|kid|baby/i.test(lowerMsg)) {
    intent = 'checking safety for children'
  }
  
  return { preferences: newPrefs, lastIntent: intent }
}

// Custom component for rendering AI-generated content with visual enhancements
function GenerativeContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  // While streaming, show a loading state instead of partial JSON
  if (isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white animate-bounce" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-700 font-medium">Generating UI...</p>
          <p className="text-sm text-slate-500 mt-1">AI is thinking</p>
        </div>
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <ThesysUIRenderer response={content} />
    </div>
  )
}

// Floating Action Button component
function FloatingActions({ 
  onScanBarcode, 
  onScanIngredients,
  isExpanded,
  onToggle 
}: { 
  onScanBarcode: () => void
  onScanIngredients: () => void
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="fixed bottom-24 right-4 z-30 flex flex-col items-end gap-2">
      {/* Expanded options */}
      {isExpanded && (
        <>
          <button
            onClick={onScanBarcode}
            className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-lg border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all animate-fade-in-up"
          >
            <ScanBarcode className="w-5 h-5" />
            <span className="text-sm font-medium">Scan Barcode</span>
          </button>
          <button
            onClick={onScanIngredients}
            className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-lg border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all animate-fade-in-up"
            style={{ animationDelay: '50ms' }}
          >
            <Camera className="w-5 h-5" />
            <span className="text-sm font-medium">Scan Ingredients</span>
          </button>
        </>
      )}
      
      {/* Main FAB */}
      <button
        onClick={onToggle}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
          isExpanded 
            ? 'bg-slate-800 text-white rotate-45' 
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-emerald-500/30'
        }`}
      >
        {isExpanded ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  )
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info

  return (
    <div className={`fixed bottom-32 left-1/2 -translate-x-1/2 z-50 ${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-up max-w-[90vw]`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showIngredientScanner, setShowIngredientScanner] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonItems, setComparisonItems] = useState<ScanHistoryItem[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [fabExpanded, setFabExpanded] = useState(false)
  const [welcomeGenerated, setWelcomeGenerated] = useState(false)
  const [sessionMemory, setSessionMemory] = useState<SessionMemory>({ preferences: [], lastIntent: undefined })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { user, profile, signOut, isLoading: authLoading } = useAuth()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // Generate AI welcome message on first load
  useEffect(() => {
    if (!welcomeGenerated && !authLoading && messages.length === 0) {
      generateWelcomeMessage()
      setWelcomeGenerated(true)
    }
  }, [authLoading, welcomeGenerated, messages.length])

  const generateId = () => Math.random().toString(36).substring(2, 9)

  // Generate personalized welcome UI from AI
  const generateWelcomeMessage = async () => {
    setIsLoading(true)
    setStreamingContent('')

    try {
      const contextInfo = {
        isLoggedIn: !!user,
        userName: profile?.display_name || user?.email?.split('@')[0],
        dietaryRestrictions: profile?.dietary_restrictions || [],
        allergens: profile?.allergens || [],
        timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a welcome UI for the user. Context: ${JSON.stringify(contextInfo)}. 
          Create an engaging, personalized welcome that encourages them to scan a product or ask questions.
          Use WelcomeCard component for the hero, include SuggestionChips for quick questions.`,
          history: [],
          isWelcome: true
        })
      })

      if (!response.ok) throw new Error('Failed to get welcome')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setStreamingContent(accumulated)
        }
      }

      const welcomeMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: accumulated
      }
      setMessages([welcomeMessage])
      setStreamingContent('')

    } catch (error) {
      console.error('Welcome error:', error)
      // Fallback to static welcome if AI fails
      const fallbackWelcome: Message = {
        id: generateId(),
        role: 'assistant',
        content: JSON.stringify({
          component: {
            component: 'Card',
            props: {
              children: [
                {
                  component: 'WelcomeCard',
                  props: {
                    greeting: profile?.display_name ? `Hey ${profile.display_name}` : 'Welcome',
                    message: "I'm your AI food copilot. Scan a barcode or ask me anything about ingredients!",
                    suggestions: [
                      { text: "What's maltodextrin?", query: "What's maltodextrin and is it safe?" },
                      { text: "Is palm oil bad?", query: "Is palm oil bad for health?" },
                      { text: "Explain E621", query: "What is E621 additive?" }
                    ]
                  }
                }
              ]
            }
          },
          error: null
        })
      }
      setMessages([fallbackWelcome])
      setStreamingContent('')
    }

    setIsLoading(false)
  }

  // Action handlers for interactive components
  const actionHandlers = {
    onScanBarcode: () => setShowBarcodeScanner(true),
    onScanIngredients: () => setShowIngredientScanner(true),
    onAskQuestion: (question: string) => streamChat(question),
    onViewHistory: () => setShowHistory(true),
    onCompareProducts: (barcodes: string[]) => console.log('Compare:', barcodes),
    onFeedback: (type: 'positive' | 'negative', messageId?: string) => {
      console.log('Feedback:', type, messageId)
      // Could send to analytics or backend
    }
  }

  // Stream chat response from Thesys C1 API
  const streamChat = async (message: string, productContext?: any) => {
    setIsLoading(true)
    setStreamingContent('')

    // Update session memory based on user message
    const updatedMemory = extractPreferences(message, sessionMemory)
    setSessionMemory(updatedMemory)

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: message,
      type: productContext ? 'scan' : 'text'
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          productContext,
          sessionMemory: updatedMemory
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setStreamingContent(accumulated)
        }
      }

      // Add the complete message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: accumulated,
        productContext
      }
      setMessages(prev => [...prev, assistantMessage])
      setStreamingContent('')

    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'I had trouble processing that. Please try again.'
      }
      setMessages(prev => [...prev, errorMessage])
      setStreamingContent('')
    }

    setIsLoading(false)
  }

  const analyzeBarcode = async (barcode: string) => {
    setIsLoading(true)
    setStreamingContent('')

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: `🔍 Scanning barcode: ${barcode}`,
      type: 'scan'
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // Build URL with user preferences
      let url = `/api/analyze/${barcode}`
      if (profile) {
        const params = new URLSearchParams()
        if (profile.dietary_restrictions.length > 0) {
          params.set('dietary', profile.dietary_restrictions.join(','))
        }
        if (profile.allergens.length > 0) {
          params.set('allergens', profile.allergens.join(','))
        }
        if (params.toString()) {
          url += `?${params.toString()}`
        }
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.error) {
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: data.error === 'Product not found'
            ? `I couldn't find that product in the database. This might be a regional product or one that hasn't been cataloged yet. Try scanning the ingredient list directly!`
            : `Something went wrong while looking that up. Want to try again?`
        }
        setMessages(prev => [...prev, errorMessage])
      } else {
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: data.analysis,
          productContext: {
            name: data.product.product_name,
            brand: data.product.brand,
            barcode: data.product.barcode,
            novaGroup: data.product.nova_group,
            nutriScore: data.product.nutri_score,
            productId: data.product.product_id
          }
        }
        setMessages(prev => [...prev, assistantMessage])

        // Save to scan history if user is logged in
        if (user) {
          console.log('Attempting to save scan to history for user:', user.id)
          try {
            const result = await addToScanHistory(user.id, {
              barcode: data.product.barcode,
              product_name: data.product.product_name,
              brand: data.product.brand,
              nova_group: data.product.nova_group,
              nutri_score: data.product.nutri_score,
              product_id: data.product.product_id
            })
            if (result.data) {
              console.log('✅ Saved to history successfully:', result.data.id)
              setToast({ message: 'Saved to scan history', type: 'success' })
            } else if (result.error) {
              console.warn('⚠️ Failed to save to history:', result.error)
              // Only show error toast if it's a real error (not duplicate)
              if (!result.error.includes('duplicate')) {
                setToast({ message: result.error, type: 'error' })
              }
            }
          } catch (err) {
            console.error('❌ Failed to save to history:', err)
            setToast({ message: 'Could not save to history', type: 'error' })
          }
        } else {
          console.log('User not logged in, skipping history save')
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `I had trouble connecting. Let's try that again.`
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setIsLoading(false)
  }

  const analyzeIngredients = async (ingredientsText: string) => {
    await streamChat(
      `I scanned these ingredients from a food package. Please analyze them and provide a clear breakdown showing: what's good, what needs attention, and any uncertainties. Format your response with clear sections and use markdown.\n\nIngredients:\n${ingredientsText}`
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const trimmedInput = input.trim()
    setInput('')

    const isBarcodePattern = /^\d{8,14}$/.test(trimmedInput)

    if (isBarcodePattern) {
      await analyzeBarcode(trimmedInput)
    } else {
      await streamChat(trimmedInput)
    }
  }

  const handleBarcodeScan = (barcode: string) => {
    setShowBarcodeScanner(false)
    analyzeBarcode(barcode)
  }

  const handleIngredientScan = (text: string) => {
    setShowIngredientScanner(false)
    analyzeIngredients(text)
  }

  const clearChat = () => {
    setMessages([])
    setStreamingContent('')
    setWelcomeGenerated(false) // Reset so welcome regenerates
  }

  const getNutriScoreColor = (score: string): string => {
    const colors: Record<string, string> = {
      'a': 'bg-green-500',
      'b': 'bg-lime-500',
      'c': 'bg-yellow-500',
      'd': 'bg-orange-500',
      'e': 'bg-red-500'
    }
    return colors[score?.toLowerCase()] || 'bg-slate-400'
  }

  const getNovaGroupInfo = (nova: number): { color: string; label: string } => {
    const info: Record<number, { color: string; label: string }> = {
      1: { color: 'bg-green-500', label: 'Minimally processed' },
      2: { color: 'bg-lime-500', label: 'Processed ingredients' },
      3: { color: 'bg-yellow-500', label: 'Processed foods' },
      4: { color: 'bg-red-500', label: 'Ultra-processed' },
    }
    return info[nova] || { color: 'bg-slate-400', label: 'Unknown' }
  }

  return (
    <ActionProvider handlers={actionHandlers}>
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Minimal Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-emerald-100/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-800">Food Co-Pilot</h1>
                <p className="text-xs text-slate-400">AI-Native • Generative UI</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* History Button */}
              {user && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title="Scan History"
                >
                  <History className="w-5 h-5" />
                </button>
              )}

              {/* Clear Chat */}
              {messages.length > 1 && (
                <button
                  onClick={clearChat}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="New conversation"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              {/* User Menu / Auth */}
              {authLoading ? (
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-medium">
                      {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {profile?.display_name || 'User'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {user.email}
                          </p>
                        </div>
                        <button
                          onClick={() => { setShowPreferences(true); setShowUserMenu(false) }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                        >
                          <Settings className="w-4 h-4" />
                          Preferences
                        </button>
                        <button
                          onClick={() => { setShowHistory(true); setShowUserMenu(false) }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                        >
                          <History className="w-4 h-4" />
                          Scan History
                        </button>
                        <hr className="my-2 border-slate-100" />
                        <button
                          onClick={() => { signOut(); setShowUserMenu(false) }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Pure Conversational UI */}
      <main className="max-w-4xl mx-auto px-4 pb-32">
        {/* Messages - ALL content is AI-generated */}
        <div className="py-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`fade-in ${message.role === 'user' ? 'flex justify-end' : ''}`}
            >
              {message.role === 'user' ? (
                <div className="max-w-[85%] bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl rounded-br-md px-5 py-3 shadow-lg shadow-emerald-500/20">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Product Context Badge */}
                  {message.productContext && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-800 block truncate">
                          {message.productContext.name}
                        </span>
                        {message.productContext.brand && (
                          <span className="text-sm text-slate-500">
                            by {message.productContext.brand}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {message.productContext.nutriScore && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                            getNutriScoreColor(message.productContext.nutriScore)
                          }`}>
                            {message.productContext.nutriScore.toUpperCase()}
                          </span>
                        )}
                        {message.productContext.novaGroup && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                            getNovaGroupInfo(message.productContext.novaGroup).color
                          }`}>
                            NOVA {message.productContext.novaGroup}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Response - Generative Content */}
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl rounded-tl-md border border-white/50 shadow-lg overflow-hidden">
                    <GenerativeContent content={message.content} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming Content */}
          {streamingContent && (
            <div className="fade-in space-y-3">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl rounded-tl-md border border-white/50 shadow-lg overflow-hidden">
                <GenerativeContent content={streamingContent} isStreaming={true} />
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex items-center gap-3 text-slate-500 fade-in">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              </div>
              <span className="text-sm">Generating response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Floating Action Button */}
      <FloatingActions
        onScanBarcode={() => { setFabExpanded(false); setShowBarcodeScanner(true) }}
        onScanIngredients={() => { setFabExpanded(false); setShowIngredientScanner(true) }}
        isExpanded={fabExpanded}
        onToggle={() => setFabExpanded(!fabExpanded)}
      />

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-4">
        <div className="max-w-4xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex gap-2">
              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any food, ingredient, or paste a barcode..."
                  className="w-full px-5 py-3.5 pr-12 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all shadow-lg"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Ingredient Scanner Modal */}
      {showIngredientScanner && (
        <IngredientScanner
          onScan={handleIngredientScan}
          onClose={() => setShowIngredientScanner(false)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* User Preferences Modal */}
      <UserPreferences
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />

      {/* Scan History Modal */}
      <ScanHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onRescan={(barcode) => analyzeBarcode(barcode)}
        onCompare={(items) => {
          setComparisonItems(items)
          setShowComparison(true)
        }}
      />

      {/* Product Comparison Modal */}
      <ProductComparison
        isOpen={showComparison}
        onClose={() => {
          setShowComparison(false)
          setComparisonItems([])
        }}
        items={comparisonItems}
      />

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
    </ActionProvider>
  )
}

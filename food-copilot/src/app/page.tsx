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
  Scale
} from 'lucide-react'
import dynamic from 'next/dynamic'
import ThesysUIRenderer from '@/components/ThesysUI'
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
          <p className="text-slate-700 font-medium">Generating Generative UI...</p>
          <p className="text-sm text-slate-500 mt-1">Analyzing with Thesys C1</p>
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showIngredientScanner, setShowIngredientScanner] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonItems, setComparisonItems] = useState<ScanHistoryItem[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { user, profile, signOut, isLoading: authLoading } = useAuth()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  const generateId = () => Math.random().toString(36).substring(2, 9)

  // Stream chat response from Thesys C1 API
  const streamChat = async (message: string, productContext?: any) => {
    setIsLoading(true)
    setStreamingContent('')

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
          productContext
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
            if (result) {
              console.log('✅ Saved to history successfully:', result.id)
            } else {
              console.warn('⚠️ addToScanHistory returned null (might be duplicate or error)')
            }
          } catch (err) {
            console.error('❌ Failed to save to history:', err)
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-emerald-100/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-slate-800">Food Co-Pilot</h1>
                <p className="text-xs text-slate-500">Thesys C1 • Generative UI</p>
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
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Clear chat"
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
                    <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[100px] truncate">
                      {profile?.display_name || user.email?.split('@')[0]}
                    </span>
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
                          {(profile?.dietary_restrictions?.length || 0) + (profile?.allergens?.length || 0) > 0 && (
                            <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              {(profile?.dietary_restrictions?.length || 0) + (profile?.allergens?.length || 0)}
                            </span>
                          )}
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
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pb-32">
        {/* Hero Section - Show when no messages */}
        {messages.length === 0 && !streamingContent && (
          <div className="pt-16 pb-8 text-center fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Powered by Thesys C1
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Understand what you're{' '}
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                really eating
              </span>
            </h2>
            <p className="text-slate-600 text-lg max-w-xl mx-auto mb-8">
              Scan a barcode or ingredient list and get instant, intelligent AI analysis. 
              No jargon, just clear answers with beautiful Generative UI.
            </p>

            {/* Personalization Badge */}
            {user && profile && (profile.dietary_restrictions.length > 0 || profile.allergens.length > 0) && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm mb-6">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Personalized for: {[...profile.dietary_restrictions, ...profile.allergens].slice(0, 3).join(', ')}
                  {(profile.dietary_restrictions.length + profile.allergens.length) > 3 && ' +more'}
                </span>
                <button 
                  onClick={() => setShowPreferences(true)}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Edit
                </button>
              </div>
            )}

            {/* Sign In Prompt for non-users */}
            {!user && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm mb-6">
                <Info className="w-4 h-4" />
                <span>Sign in to save history, preferences & compare products</span>
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="ml-2 text-amber-600 hover:text-amber-800 underline font-medium"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => setShowBarcodeScanner(true)}
                className="group flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all"
              >
                <ScanBarcode className="w-5 h-5" />
                Scan Barcode
                <span className="text-emerald-200 text-sm">→</span>
              </button>
              <button
                onClick={() => setShowIngredientScanner(true)}
                className="group flex items-center justify-center gap-3 px-6 py-4 bg-white text-slate-700 rounded-2xl font-medium shadow-lg border border-slate-200 hover:shadow-xl hover:border-emerald-200 hover:-translate-y-0.5 transition-all"
              >
                <Camera className="w-5 h-5" />
                Scan Ingredients
                <span className="text-slate-400 text-sm">→</span>
              </button>
            </div>

            {/* Quick prompts */}
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Or try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "What's maltodextrin?",
                  "Is palm oil bad?",
                  "Explain E621",
                  "NOVA 4 meaning?"
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => streamChat(prompt)}
                    className="px-4 py-2 bg-white/80 backdrop-blur border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
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
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">NutriScore</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                              getNutriScoreColor(message.productContext.nutriScore)
                            }`}>
                              {message.productContext.nutriScore.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {message.productContext.novaGroup && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">NOVA</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
                              getNovaGroupInfo(message.productContext.novaGroup).color
                            }`}>
                              {message.productContext.novaGroup}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Response - Generative Content */}
                  <div className="bg-white/80 backdrop-blur-md rounded-2xl rounded-tl-md border border-white/50 shadow-lg overflow-hidden p-5">
                    <GenerativeContent content={message.content} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming Content */}
          {streamingContent && (
            <div className="fade-in space-y-3">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl rounded-tl-md border border-white/50 shadow-lg overflow-hidden p-5">
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

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-8 pb-6">
        <div className="max-w-4xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex gap-2">
              {/* Scan Buttons */}
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
                title="Scan barcode"
              >
                <ScanBarcode className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowIngredientScanner(true)}
                className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
                title="Scan ingredients"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about a food or paste a barcode..."
                  className="w-full px-5 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all shadow-sm"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
          <p className="text-center text-xs text-slate-400 mt-3">
            Powered by Thesys C1 Generative UI • Data from Open Food Facts
          </p>
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
    </div>
  )
}

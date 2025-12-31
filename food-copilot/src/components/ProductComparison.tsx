'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  Loader2, 
  Scale, 
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Sparkles
} from 'lucide-react'
import { ScanHistoryItem } from '@/lib/supabase'
import ThesysUIRenderer from './ThesysUI'

interface ProductComparisonProps {
  isOpen: boolean
  onClose: () => void
  items: ScanHistoryItem[]
}

interface ComparisonResult {
  analysis: string
  winner?: string
  isLoading: boolean
  error?: string
}

export default function ProductComparison({ isOpen, onClose, items }: ProductComparisonProps) {
  const [result, setResult] = useState<ComparisonResult>({
    analysis: '',
    isLoading: false
  })

  useEffect(() => {
    if (isOpen && items.length >= 2) {
      runComparison()
    }
  }, [isOpen, items])

  const runComparison = async () => {
    setResult({ analysis: '', isLoading: true })

    try {
      const barcodes = items.map(item => item.barcode)
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodes })
      })

      if (!response.ok) {
        throw new Error('Failed to compare products')
      }

      const data = await response.json()
      setResult({
        analysis: data.analysis,
        winner: data.winner,
        isLoading: false
      })
    } catch (error: any) {
      setResult({
        analysis: '',
        isLoading: false,
        error: error.message || 'Failed to compare products'
      })
    }
  }

  const getNutriScoreColor = (score: string | null): string => {
    if (!score) return 'bg-slate-300'
    const colors: Record<string, string> = {
      'a': 'bg-green-500',
      'b': 'bg-lime-500',
      'c': 'bg-yellow-500',
      'd': 'bg-orange-500',
      'e': 'bg-red-500'
    }
    return colors[score.toLowerCase()] || 'bg-slate-300'
  }

  const getNovaColor = (nova: number | null): string => {
    if (!nova) return 'bg-slate-300'
    const colors: Record<number, string> = {
      1: 'bg-green-500',
      2: 'bg-lime-500',
      3: 'bg-yellow-500',
      4: 'bg-red-500'
    }
    return colors[nova] || 'bg-slate-300'
  }

  const compareScores = (items: ScanHistoryItem[], key: 'nutri_score' | 'nova_group') => {
    if (key === 'nutri_score') {
      const scores = items.map(i => i.nutri_score?.toLowerCase() || 'z')
      const best = Math.min(...scores.map(s => s.charCodeAt(0)))
      return items.map(i => {
        const score = i.nutri_score?.toLowerCase() || 'z'
        if (score.charCodeAt(0) === best && scores.filter(s => s === score).length === 1) {
          return 'best'
        }
        return null
      })
    } else {
      const novas = items.map(i => i.nova_group || 5)
      const best = Math.min(...novas)
      return items.map(i => {
        const nova = i.nova_group || 5
        if (nova === best && novas.filter(n => n === nova).length === 1) {
          return 'best'
        }
        return null
      })
    }
  }

  const nutriScoreComparison = compareScores(items, 'nutri_score')
  const novaComparison = compareScores(items, 'nova_group')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 relative bg-gradient-to-br from-blue-500 to-indigo-600 px-6 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Product Comparison</h2>
              <p className="text-blue-100 text-sm">
                Comparing {items.length} products side-by-side
              </p>
            </div>
          </div>
        </div>

        {/* Product Cards */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 p-4">
          <div className={`grid gap-4 ${items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {items.map((item, index) => {
              const isNutriBest = nutriScoreComparison[index] === 'best'
              const isNovaBest = novaComparison[index] === 'best'
              const isBestOverall = isNutriBest && isNovaBest

              return (
                <div
                  key={item.id}
                  className={`relative p-4 rounded-xl border-2 bg-white transition-all ${
                    isBestOverall
                      ? 'border-green-400 ring-2 ring-green-400/20'
                      : 'border-slate-200'
                  }`}
                >
                  {isBestOverall && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      Best Choice
                    </div>
                  )}

                  <h3 className="font-semibold text-slate-800 truncate text-center">
                    {item.product_name || 'Unknown'}
                  </h3>
                  {item.brand && (
                    <p className="text-xs text-slate-500 text-center truncate">
                      {item.brand}
                    </p>
                  )}

                  <div className="flex justify-center gap-3 mt-3">
                    {/* NutriScore */}
                    <div className={`text-center ${isNutriBest ? 'scale-110' : ''}`}>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                        NutriScore
                      </span>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className={`px-2 py-1 rounded font-bold text-white ${getNutriScoreColor(item.nutri_score)}`}>
                          {item.nutri_score?.toUpperCase() || '?'}
                        </span>
                        {isNutriBest && <TrendingUp className="w-4 h-4 text-green-500" />}
                      </div>
                    </div>

                    {/* NOVA */}
                    <div className={`text-center ${isNovaBest ? 'scale-110' : ''}`}>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                        NOVA
                      </span>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className={`px-2 py-1 rounded font-bold text-white ${getNovaColor(item.nova_group)}`}>
                          {item.nova_group || '?'}
                        </span>
                        {isNovaBest && <TrendingUp className="w-4 h-4 text-green-500" />}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Analysis Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {result.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white animate-bounce" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-slate-700 font-medium">Analyzing products...</p>
                <p className="text-sm text-slate-500 mt-1">Comparing ingredients and nutritional data</p>
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : result.error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
              <h3 className="font-medium text-slate-700">Comparison Failed</h3>
              <p className="text-sm text-slate-500 mt-1">{result.error}</p>
              <button
                onClick={runComparison}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : result.analysis ? (
            <div className="bg-white rounded-xl">
              <ThesysUIRenderer response={result.analysis} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

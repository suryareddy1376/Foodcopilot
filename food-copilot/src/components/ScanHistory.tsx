'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  X, 
  Clock, 
  Star, 
  Trash2, 
  RotateCcw, 
  Loader2,
  Package,
  ChevronRight,
  StarOff,
  RefreshCw
} from 'lucide-react'
import { useAuth } from './AuthProvider'
import { 
  getScanHistory, 
  toggleFavorite, 
  deleteFromHistory, 
  clearHistory,
  ScanHistoryItem 
} from '@/lib/supabase'

interface ScanHistoryProps {
  isOpen: boolean
  onClose: () => void
  onRescan: (barcode: string) => void
  onCompare: (items: ScanHistoryItem[]) => void
}

export default function ScanHistory({ isOpen, onClose, onRescan, onCompare }: ScanHistoryProps) {
  const { user, isLoading: authLoading } = useAuth()
  const [history, setHistory] = useState<ScanHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isClearing, setIsClearing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    console.log('loadHistory called, user:', user?.id || 'null')
    
    if (!user) {
      console.log('No user, setting error')
      setError('Please log in to view scan history')
      setHistory([])
      return
    }
    
    setError(null)
    console.log('Loading history for user:', user.id)
    
    try {
      const data = await getScanHistory(user.id)
      console.log('History loaded:', data.length, 'items')
      setHistory(data)
    } catch (err: any) {
      console.error('Failed to load history:', err)
      setError('Failed to load history. Please try again.')
      setHistory([])
    }
  }, [user])

  useEffect(() => {
    console.log('ScanHistory useEffect - isOpen:', isOpen, 'authLoading:', authLoading, 'user:', user?.id || 'null')
    
    if (!isOpen) return
    
    // Still loading auth state
    if (authLoading) {
      setIsLoading(true)
      return
    }
    
    if (user) {
      setIsLoading(true)
      setError(null)
      loadHistory().finally(() => {
        console.log('loadHistory finished, setting isLoading to false')
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
      setHistory([])
      setError('Please log in to view scan history')
    }
  }, [isOpen, user, authLoading, loadHistory])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadHistory()
    setIsRefreshing(false)
  }

  const handleToggleFavorite = async (item: ScanHistoryItem) => {
    const success = await toggleFavorite(item.id, !item.is_favorite)
    if (success) {
      setHistory(prev =>
        prev.map(h =>
          h.id === item.id ? { ...h, is_favorite: !h.is_favorite } : h
        )
      )
    }
  }

  const handleDelete = async (itemId: string) => {
    setDeletingId(itemId)
    const success = await deleteFromHistory(itemId)
    if (success) {
      setHistory(prev => prev.filter(h => h.id !== itemId))
      setSelectedItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
    setDeletingId(null)
  }

  const handleClearAll = async () => {
    if (!user || !confirm('Clear all non-favorite items from history?')) return
    setIsClearing(true)
    const success = await clearHistory(user.id)
    if (success) {
      setHistory(prev => prev.filter(h => h.is_favorite))
      setSelectedItems(new Set())
    }
    setIsClearing(false)
  }

  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else if (next.size < 3) {
        next.add(itemId)
      }
      return next
    })
  }

  const handleCompare = () => {
    const itemsToCompare = history.filter(h => selectedItems.has(h.id))
    onCompare(itemsToCompare)
    onClose()
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

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString()
  }

  const favorites = history.filter(h => h.is_favorite)
  const recent = history.filter(h => !h.is_favorite)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 relative bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-6 text-white">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Refresh history"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Scan History</h2>
              <p className="text-emerald-100 text-sm">
                {history.length} items • Select 2-3 to compare
              </p>
            </div>
          </div>
        </div>

        {/* Compare Bar */}
        {selectedItems.size >= 2 && (
          <div className="flex-shrink-0 bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedItems.size} products selected
            </span>
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              Compare Now
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm text-slate-500 mt-3">Loading history...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-6">
              <Package className="w-12 h-12 text-red-300 mx-auto mb-4" />
              <h3 className="font-medium text-red-600">{error}</h3>
              <button
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-700">No scan history yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                Products you scan will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Favorites Section */}
              {favorites.length > 0 && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 fill-amber-400" />
                    Favorites
                  </h3>
                  <div className="space-y-2">
                    {favorites.map(item => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        isDeleting={deletingId === item.id}
                        onToggleSelect={() => toggleSelection(item.id)}
                        onToggleFavorite={() => handleToggleFavorite(item)}
                        onDelete={() => handleDelete(item.id)}
                        onRescan={() => { onRescan(item.barcode); onClose() }}
                        getNutriScoreColor={getNutriScoreColor}
                        getNovaColor={getNovaColor}
                        formatDate={formatDate}
                        canSelect={selectedItems.size < 3 || selectedItems.has(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Section */}
              {recent.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Recent
                    </h3>
                    <button
                      onClick={handleClearAll}
                      disabled={isClearing}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      {isClearing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {recent.map(item => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        isDeleting={deletingId === item.id}
                        onToggleSelect={() => toggleSelection(item.id)}
                        onToggleFavorite={() => handleToggleFavorite(item)}
                        onDelete={() => handleDelete(item.id)}
                        onRescan={() => { onRescan(item.barcode); onClose() }}
                        getNutriScoreColor={getNutriScoreColor}
                        getNovaColor={getNovaColor}
                        formatDate={formatDate}
                        canSelect={selectedItems.size < 3 || selectedItems.has(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface HistoryItemProps {
  item: ScanHistoryItem
  isSelected: boolean
  isDeleting: boolean
  onToggleSelect: () => void
  onToggleFavorite: () => void
  onDelete: () => void
  onRescan: () => void
  getNutriScoreColor: (score: string | null) => string
  getNovaColor: (nova: number | null) => string
  formatDate: (date: string) => string
  canSelect: boolean
}

function HistoryItem({
  item,
  isSelected,
  isDeleting,
  onToggleSelect,
  onToggleFavorite,
  onDelete,
  onRescan,
  getNutriScoreColor,
  getNovaColor,
  formatDate,
  canSelect
}: HistoryItemProps) {
  return (
    <div
      className={`p-3 rounded-xl border-2 transition-all ${
        isDeleting ? 'opacity-50' : ''
      } ${
        isSelected
          ? 'border-blue-400 bg-blue-50'
          : 'border-slate-100 hover:border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Selection Checkbox */}
        <button
          onClick={onToggleSelect}
          disabled={!canSelect && !isSelected}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-blue-500 border-blue-500 text-white'
              : canSelect
                ? 'border-slate-300 hover:border-blue-400'
                : 'border-slate-200 bg-slate-100 cursor-not-allowed'
          }`}
        >
          {isSelected && <span className="text-xs">✓</span>}
        </button>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-800 truncate">
            {item.product_name || 'Unknown Product'}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {item.brand && (
              <span className="text-xs text-slate-500 truncate">
                {item.brand}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {formatDate(item.scanned_at)}
            </span>
          </div>
        </div>

        {/* Scores */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.nutri_score && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${getNutriScoreColor(item.nutri_score)}`}>
              {item.nutri_score.toUpperCase()}
            </span>
          )}
          {item.nova_group && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${getNovaColor(item.nova_group)}`}>
              {item.nova_group}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggleFavorite}
            disabled={isDeleting}
            className={`p-1.5 rounded-lg transition-colors ${
              item.is_favorite
                ? 'text-amber-500 hover:bg-amber-50'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
            title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {item.is_favorite ? (
              <Star className="w-4 h-4 fill-amber-400" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onRescan}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            title="Analyze again"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { createContext, useContext } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Droplets,
  Package,
  Clock,
  Palette,
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Leaf,
  Heart,
  Activity,
  Beaker,
  Apple,
  Wheat,
  Coffee,
  Flame,
  Scale,
  ThermometerSun,
  Star,
  XCircle,
  HelpCircle,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ScanBarcode,
  Camera,
  ArrowRight,
  Search,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Share2,
  BookmarkPlus,
  ExternalLink,
  QrCode,
  Scan,
  FileText,
  ListChecks,
  CircleCheck,
  CircleX,
  CircleAlert
} from 'lucide-react'

// Context for interactive actions from parent
interface ActionHandlers {
  onScanBarcode?: () => void
  onScanIngredients?: () => void
  onAskQuestion?: (question: string) => void
  onCompareProducts?: (barcodes: string[]) => void
  onViewHistory?: () => void
  onFeedback?: (type: 'positive' | 'negative', messageId?: string) => void
}

const ActionContext = createContext<ActionHandlers>({})

function useActionHandlers() {
  return useContext(ActionContext)
}

function ActionProvider({ children, handlers }: { children: React.ReactNode; handlers: ActionHandlers }) {
  return <ActionContext.Provider value={handlers}>{children}</ActionContext.Provider>
}

// Icon mapping
const iconMap: Record<string, any> = {
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  'shield': Shield,
  'zap': Zap,
  'droplets': Droplets,
  'package': Package,
  'clock': Clock,
  'palette': Palette,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'info': Info,
  'alert-circle': AlertCircle,
  'leaf': Leaf,
  'heart': Heart,
  'activity': Activity,
  'beaker': Beaker,
  'apple': Apple,
  'wheat': Wheat,
  'coffee': Coffee,
  'flame': Flame,
  'scale': Scale,
  'thermometer-sun': ThermometerSun,
  'star': Star,
  'x-circle': XCircle,
  'help-circle': HelpCircle,
  'eye': Eye,
  'eye-off': EyeOff,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'minus': Minus,
  'sparkles': Sparkles,
  'scan-barcode': ScanBarcode,
  'camera': Camera,
  'arrow-right': ArrowRight,
  'search': Search,
  'message': MessageCircle,
  'refresh': RefreshCw,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  'share': Share2,
  'bookmark': BookmarkPlus,
  'external-link': ExternalLink,
  'qr-code': QrCode,
  'scan': Scan,
  'file-text': FileText,
  'list-checks': ListChecks,
  'circle-check': CircleCheck,
  'circle-x': CircleX,
  'circle-alert': CircleAlert,
  'message-circle': MessageCircle,
}

// Types for Thesys UI components
interface ThesysComponent {
  component: string
  props: Record<string, any>
}

interface ThesysResponse {
  component: ThesysComponent
  error: string | null
}

// Component renderers
function renderIcon(name: string, className = 'w-5 h-5') {
  const IconComponent = iconMap[name] || Info
  return <IconComponent className={className} />
}

function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-slate-800">{title || 'Analysis'}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// InlineHeader - Compact inline header
function InlineHeader({ title, subtitle, iconName }: { title?: string; subtitle?: string; iconName?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      {iconName && (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
          {renderIcon(iconName, 'w-4 h-4')}
        </div>
      )}
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function DataTile({ amount, description, child }: { amount?: string; description?: string; child?: ThesysComponent }) {
  const getAmountColor = (amount: string) => {
    const lower = amount.toLowerCase()
    if (lower.includes('safe') || lower.includes('good') || lower.includes('low')) return 'text-emerald-600'
    if (lower.includes('nova 4') || lower.includes('high') || lower.includes('ultra')) return 'text-amber-600'
    if (lower.includes('danger') || lower.includes('avoid')) return 'text-red-600'
    return 'text-slate-700'
  }

  return (
    <div className="flex items-center gap-3">
      {child && (
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          {renderThesysComponent(child)}
        </div>
      )}
      <div>
        <div className={`font-bold ${getAmountColor(amount || '')}`}>{amount || ''}</div>
        <div className="text-xs text-slate-500">{description || ''}</div>
      </div>
    </div>
  )
}

function MiniCard({ lhs, rhs }: { lhs?: ThesysComponent; rhs?: ThesysComponent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      {lhs && renderThesysComponent(lhs)}
      {rhs && renderThesysComponent(rhs)}
    </div>
  )
}

function MiniCardBlock({ children }: { children?: ThesysComponent[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
      {children?.map((child, i) => (
        <React.Fragment key={i}>{renderThesysComponent(child)}</React.Fragment>
      ))}
    </div>
  )
}

// ProfileTile - Display profile/summary info with icon and details
function ProfileTile({ 
  title, 
  subtitle, 
  description, 
  icon, 
  image,
  badge,
  children 
}: { 
  title?: string
  subtitle?: string
  description?: string
  icon?: ThesysComponent
  image?: string
  badge?: string
  children?: ThesysComponent[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon or Image */}
        {(icon || image) && (
          <div className="flex-shrink-0">
            {image ? (
              <img src={image} alt={title || ''} className="w-12 h-12 rounded-lg object-cover" />
            ) : icon ? (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                {renderThesysComponent(icon)}
              </div>
            ) : null}
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {title && <h4 className="font-semibold text-slate-800 truncate">{title}</h4>}
            {badge && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
      </div>
      
      {/* Children */}
      {children && children.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {children.map((child, i) => (
            <React.Fragment key={i}>{renderThesysComponent(child)}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

function TextContent({ textMarkdown }: { textMarkdown?: string }) {
  if (!textMarkdown) return null
  // Simple markdown-like rendering
  const lines = textMarkdown.split('\n')
  
  return (
    <div className="text-slate-600 leading-relaxed my-3 space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-emerald-500 mt-1">•</span>
              <span>{line.slice(2)}</span>
            </div>
          )
        }
        if (line.trim() === '') return <br key={i} />
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

function TagBlock({ children }: { children?: Array<{ text: string; variant: string }> }) {
  if (!children || children.length === 0) return null
  
  const getTagStyle = (variant: string) => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'error':
      case 'danger':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'info':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="flex flex-wrap gap-2 my-3">
      {children.map((tag, i) => (
        <span
          key={i}
          className={`px-3 py-1 rounded-full text-sm font-medium border ${getTagStyle(tag.variant)}`}
        >
          {tag.text}
        </span>
      ))}
    </div>
  )
}

function ListItem({ title, subtitle, iconName }: { title?: string; subtitle?: string; iconName?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      {iconName && (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
          {renderIcon(iconName, 'w-4 h-4')}
        </div>
      )}
      <div>
        <div className="font-medium text-slate-800">{title || ''}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>
    </div>
  )
}

function List({ variant, items }: { variant?: string; items?: Array<{ title: string; subtitle?: string; iconName?: string; iconCategory?: string }> }) {
  if (!items || items.length === 0) return null
  return (
    <div className="space-y-2 my-3">
      {items.map((item, i) => (
        <ListItem key={i} {...item} />
      ))}
    </div>
  )
}

function CalloutV2({ variant, title, description }: { variant?: string; title?: string; description?: string }) {
  const getStyle = () => {
    switch (variant) {
      case 'success':
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-600' }
      case 'warning':
        return { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-600' }
      case 'error':
        return { bg: 'bg-red-50', border: 'border-red-200', icon: XCircle, iconColor: 'text-red-600' }
      case 'info':
      default:
        return { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, iconColor: 'text-blue-600' }
    }
  }

  const style = getStyle()
  const IconComp = style.icon

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4 my-4`}>
      <div className="flex items-start gap-3">
        <IconComp className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        <div>
          <div className="font-semibold text-slate-800">{title || ''}</div>
          {description && <div className="text-sm text-slate-600 mt-1">{description}</div>}
        </div>
      </div>
    </div>
  )
}

function SectionBlock({ sections, isFoldable }: { sections?: Array<{ value: string; trigger: string; content: ThesysComponent[] }>; isFoldable?: boolean }) {
  const [openSections, setOpenSections] = React.useState<string[]>(
    isFoldable ? [] : (sections?.map(s => s.value) || [])
  )

  const toggleSection = (value: string) => {
    if (!isFoldable) return
    setOpenSections(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  if (!sections || sections.length === 0) return null

  return (
    <div className="space-y-3 my-4">
      {sections.map((section) => (
        <div key={section.value} className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection(section.value)}
            className={`w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors ${
              isFoldable ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <span className="font-medium text-slate-700">{section.trigger}</span>
            {isFoldable && (
              openSections.includes(section.value) 
                ? <ChevronDown className="w-5 h-5 text-slate-400" />
                : <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {(!isFoldable || openSections.includes(section.value)) && (
            <div className="px-4 py-3">
              {section.content.map((child, i) => (
                <React.Fragment key={i}>{renderThesysComponent(child)}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Card({ children }: { children?: ThesysComponent[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5">
      {children?.map((child, i) => (
        <React.Fragment key={i}>{renderThesysComponent(child)}</React.Fragment>
      ))}
    </div>
  )
}

function Icon({ name }: { name?: string }) {
  if (!name) return null
  return renderIcon(name, 'w-5 h-5 text-slate-600')
}

// ==========================================
// NEW INTERACTIVE COMPONENTS FOR AI-NATIVE UI
// ==========================================

// Action Button - AI can generate clickable buttons
function ActionButton({ 
  label, 
  action, 
  variant = 'primary',
  iconName,
  data
}: { 
  label: string
  action: 'scan-barcode' | 'scan-ingredients' | 'ask-question' | 'compare' | 'view-history' | 'external-link'
  variant?: 'primary' | 'secondary' | 'ghost'
  iconName?: string
  data?: any
}) {
  const handlers = useActionHandlers()
  
  const handleClick = () => {
    switch (action) {
      case 'scan-barcode':
        handlers.onScanBarcode?.()
        break
      case 'scan-ingredients':
        handlers.onScanIngredients?.()
        break
      case 'ask-question':
        handlers.onAskQuestion?.(data?.question || label)
        break
      case 'compare':
        handlers.onCompareProducts?.(data?.barcodes || [])
        break
      case 'view-history':
        handlers.onViewHistory?.()
        break
      case 'external-link':
        if (data?.url) window.open(data.url, '_blank')
        break
    }
  }
  
  const baseStyles = "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm"
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 shadow-sm",
    ghost: "text-emerald-600 hover:bg-emerald-50"
  }
  
  return (
    <button onClick={handleClick} className={`${baseStyles} ${variants[variant]}`}>
      {iconName && renderIcon(iconName, 'w-4 h-4')}
      {label}
      <ArrowRight className="w-4 h-4 opacity-60" />
    </button>
  )
}

// Suggestion Chips - AI can suggest follow-up questions
function SuggestionChips({ suggestions }: { suggestions: Array<{ text: string; query?: string }> }) {
  const handlers = useActionHandlers()
  
  if (!suggestions || suggestions.length === 0) return null
  
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
        <Sparkles className="w-3 h-3" /> Follow-up questions
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => handlers.onAskQuestion?.(suggestion.query || suggestion.text)}
            className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-full text-sm text-slate-600 hover:text-emerald-700 transition-all"
          >
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  )
}

// Quick Actions Row - AI can provide action buttons row
function QuickActions({ actions }: { actions: Array<{ label: string; action: string; iconName?: string; variant?: string; data?: any }> }) {
  if (!actions || actions.length === 0) return null
  
  return (
    <div className="flex flex-wrap gap-2 my-4">
      {actions.map((action, i) => (
        <ActionButton 
          key={i} 
          label={action.label} 
          action={action.action as any} 
          iconName={action.iconName}
          variant={(action.variant as any) || 'secondary'}
          data={action.data}
        />
      ))}
    </div>
  )
}

// Hero Section - AI can generate dynamic hero content
function HeroSection({ 
  title, 
  subtitle, 
  badge,
  actions 
}: { 
  title: string
  subtitle?: string
  badge?: string
  actions?: Array<{ label: string; action: string; iconName?: string; variant?: string }>
}) {
  return (
    <div className="text-center py-6">
      {badge && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          {badge}
        </div>
      )}
      <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
        {title}
      </h2>
      {subtitle && (
        <p className="text-slate-600 text-lg max-w-xl mx-auto mb-6">
          {subtitle}
        </p>
      )}
      {actions && actions.length > 0 && (
        <QuickActions actions={actions} />
      )}
    </div>
  )
}

// Welcome Card - AI-generated personalized welcome
function WelcomeCard({ 
  greeting, 
  message,
  userName,
  suggestions 
}: { 
  greeting?: string
  message?: string
  userName?: string
  suggestions?: Array<{ text: string; query?: string }>
}) {
  const handlers = useActionHandlers()
  
  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-500/20">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold mb-1">
            {greeting || 'Hello'}{userName ? `, ${userName}` : ''}! 👋
          </h2>
          <p className="text-emerald-100 text-sm">
            {message || "What would you like to know about your food today?"}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <Leaf className="w-6 h-6" />
        </div>
      </div>
      
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => handlers.onScanBarcode?.()}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-all"
        >
          <ScanBarcode className="w-4 h-4" />
          Scan Barcode
        </button>
        <button
          onClick={() => handlers.onScanIngredients?.()}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-all"
        >
          <Camera className="w-4 h-4" />
          Scan Ingredients
        </button>
      </div>
      
      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-xs text-emerald-100 mb-2">Quick questions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handlers.onAskQuestion?.(s.query || s.text)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs transition-all"
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Product Summary Card - Compact product info
function ProductSummary({ 
  name, 
  brand, 
  nutriScore, 
  novaGroup,
  imageUrl,
  verdict,
  verdictType
}: { 
  name: string
  brand?: string
  nutriScore?: string
  novaGroup?: number
  imageUrl?: string
  verdict?: string
  verdictType?: 'good' | 'warning' | 'bad'
}) {
  const getNutriColor = (score: string) => {
    const colors: Record<string, string> = { a: 'bg-green-500', b: 'bg-lime-500', c: 'bg-yellow-500', d: 'bg-orange-500', e: 'bg-red-500' }
    return colors[score?.toLowerCase()] || 'bg-slate-400'
  }
  
  const getNovaColor = (nova: number) => {
    const colors: Record<number, string> = { 1: 'bg-green-500', 2: 'bg-lime-500', 3: 'bg-yellow-500', 4: 'bg-red-500' }
    return colors[nova] || 'bg-slate-400'
  }
  
  const verdictStyles = {
    good: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    bad: 'bg-red-50 border-red-200 text-red-700'
  }
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex gap-4">
        {imageUrl && (
          <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{name}</h3>
          {brand && <p className="text-sm text-slate-500">{brand}</p>}
          <div className="flex items-center gap-2 mt-2">
            {nutriScore && (
              <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${getNutriColor(nutriScore)}`}>
                {nutriScore.toUpperCase()}
              </span>
            )}
            {novaGroup && (
              <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${getNovaColor(novaGroup)}`}>
                NOVA {novaGroup}
              </span>
            )}
          </div>
        </div>
      </div>
      {verdict && (
        <div className={`mt-3 px-3 py-2 rounded-lg border text-sm ${verdictStyles[verdictType || 'warning']}`}>
          {verdict}
        </div>
      )}
    </div>
  )
}

// Feedback Row - Let users react to AI response
function FeedbackRow({ messageId }: { messageId?: string }) {
  const handlers = useActionHandlers()
  const [feedback, setFeedback] = React.useState<'positive' | 'negative' | null>(null)
  
  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type)
    handlers.onFeedback?.(type, messageId)
  }
  
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
      <span className="text-xs text-slate-400">Was this helpful?</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleFeedback('positive')}
          className={`p-2 rounded-lg transition-all ${
            feedback === 'positive' 
              ? 'bg-emerald-100 text-emerald-600' 
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleFeedback('negative')}
          className={`p-2 rounded-lg transition-all ${
            feedback === 'negative' 
              ? 'bg-red-100 text-red-600' 
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ==========================================
// NATIVE THESYS SDK COMPONENTS
// ==========================================

// Button - Native Thesys button component
function Button({ 
  children, 
  name, 
  variant = 'primary',
  iconLeft,
  action 
}: { 
  children?: string
  name?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  iconLeft?: ThesysComponent
  action?: { type: string; props?: any }
}) {
  const handlers = useActionHandlers()
  
  const handleClick = () => {
    const buttonText = (children || '').toLowerCase()
    const buttonName = (name || '').toLowerCase()
    
    // Check for scan-related actions
    const isScanBarcode = 
      buttonName.includes('barcode') || 
      buttonName.includes('scan') ||
      buttonText.includes('scan') ||
      buttonText.includes('barcode') ||
      action?.type === 'scan-barcode'
    
    const isScanIngredients = 
      buttonName.includes('ingredient') ||
      buttonText.includes('ingredient') ||
      action?.type === 'scan-ingredients'
    
    const isLearnMore = 
      buttonText.includes('learn') ||
      buttonText.includes('more') ||
      buttonText.includes('info')
    
    if (isScanIngredients) {
      handlers.onScanIngredients?.()
    } else if (isScanBarcode) {
      handlers.onScanBarcode?.()
    } else if (isLearnMore) {
      // For learn more, ask a follow-up question
      handlers.onAskQuestion?.('Tell me more about this')
    } else if (action?.type === 'continue_conversation') {
      // Generic continue conversation - use button text as query
      handlers.onAskQuestion?.(children || 'Tell me more')
    } else if (action?.props?.query) {
      // If action has a query prop, use it
      handlers.onAskQuestion?.(action.props.query)
    } else {
      // Fallback: use button text as question
      handlers.onAskQuestion?.(children || name || 'Tell me more')
    }
  }
  
  const baseStyles = "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all text-sm cursor-pointer"
  const variants: Record<string, string> = {
    primary: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 shadow-sm",
    ghost: "text-emerald-600 hover:bg-emerald-50",
    outline: "border border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-600"
  }
  
  return (
    <button onClick={handleClick} className={`${baseStyles} ${variants[variant] || variants.primary}`}>
      {iconLeft && renderThesysComponent(iconLeft)}
      {children}
    </button>
  )
}

// ButtonGroup - Container for multiple buttons
function ButtonGroup({ 
  variant = 'horizontal', 
  children 
}: { 
  variant?: 'horizontal' | 'vertical'
  children?: ThesysComponent[]
}) {
  if (!children || children.length === 0) return null
  
  const layoutClass = variant === 'vertical' 
    ? 'flex flex-col gap-2' 
    : 'flex flex-wrap gap-2'
  
  return (
    <div className={`${layoutClass} my-4`}>
      {children.map((child, i) => (
        <React.Fragment key={i}>{renderThesysComponent(child)}</React.Fragment>
      ))}
    </div>
  )
}

// FollowUpBlock - Native Thesys follow-up suggestions
function FollowUpBlock({ followUpText }: { followUpText?: string[] }) {
  const handlers = useActionHandlers()
  
  if (!followUpText || followUpText.length === 0) return null
  
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
        <Sparkles className="w-3 h-3" /> Suggestions
      </p>
      <div className="flex flex-wrap gap-2">
        {followUpText.map((text, i) => (
          <button
            key={i}
            onClick={() => handlers.onAskQuestion?.(text)}
            className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-full text-sm text-slate-600 hover:text-emerald-700 transition-all"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

// ChipGroup - Group of selectable chips
function ChipGroup({ children }: { children?: ThesysComponent[] }) {
  if (!children || children.length === 0) return null
  
  return (
    <div className="flex flex-wrap gap-2 my-3">
      {children.map((child, i) => (
        <React.Fragment key={i}>{renderThesysComponent(child)}</React.Fragment>
      ))}
    </div>
  )
}

// Chip - Individual selectable chip
function Chip({ label, selected, onClick }: { label?: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        selected 
          ? 'bg-emerald-500 text-white' 
          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
      }`}
    >
      {label}
    </button>
  )
}

// Divider - Visual separator
function Divider() {
  return <hr className="my-4 border-slate-200" />
}

// Main renderer function
function renderThesysComponent(component: ThesysComponent): React.ReactNode {
  const { component: type, props } = component

  switch (type) {
    case 'Card':
      return <Card {...props} />
    case 'Header':
      return <Header {...props} />
    case 'InlineHeader':
      return <InlineHeader {...props} />
    case 'DataTile':
      return <DataTile {...props} />
    case 'MiniCard':
      return <MiniCard {...props} />
    case 'MiniCardBlock':
      return <MiniCardBlock {...props} />
    case 'ProfileTile':
      return <ProfileTile {...props} />
    case 'TextContent':
      return <TextContent {...props} />
    case 'TagBlock':
      return <TagBlock {...props} />
    case 'List':
      return <List {...props} />
    case 'CalloutV2':
      return <CalloutV2 {...props} />
    case 'SectionBlock':
      return <SectionBlock {...props} />
    case 'Icon':
      return <Icon {...props} />
    // NEW INTERACTIVE COMPONENTS
    case 'ActionButton':
      return <ActionButton label={props.label || ''} action={props.action || 'ask-question'} {...props} />
    case 'SuggestionChips':
      return <SuggestionChips suggestions={props.suggestions || []} />
    case 'QuickActions':
      return <QuickActions actions={props.actions || []} />
    case 'HeroSection':
      return <HeroSection title={props.title || ''} {...props} />
    case 'WelcomeCard':
      return <WelcomeCard {...props} />
    case 'ProductSummary':
      return <ProductSummary name={props.name || 'Unknown Product'} {...props} />
    case 'FeedbackRow':
      return <FeedbackRow {...props} />
    // NATIVE THESYS SDK COMPONENTS
    case 'Button':
      return <Button {...props} />
    case 'ButtonGroup':
      return <ButtonGroup {...props} />
    case 'FollowUpBlock':
      return <FollowUpBlock {...props} />
    case 'ChipGroup':
      return <ChipGroup {...props} />
    case 'Chip':
      return <Chip {...props} />
    case 'Divider':
      return <Divider />
    default:
      console.warn(`Unknown Thesys component: ${type}`)
      return <div className="text-red-500">Unknown component: {type}</div>
  }
}

// Export the main component
export function ThesysUIRenderer({ response }: { response: string }) {
  // Handle empty or invalid response
  if (!response || typeof response !== 'string' || response.trim() === '') {
    return (
      <div className="text-slate-500 italic">
        No content to display
      </div>
    )
  }
  
  // Try to parse as Thesys JSON response
  try {
    let jsonStr = response.trim()
    
    // Handle <content thesys="true"> wrapper from Thesys C1
    // First, try to find the FIRST complete content block
    const contentMatch = jsonStr.match(/<content\s+thesys="true">\s*([\s\S]*?)\s*<\/content>/i)
    if (contentMatch) {
      jsonStr = contentMatch[1]
    } else if (jsonStr.startsWith('<content')) {
      // Handle unclosed tag (streaming)
      const startIdx = jsonStr.indexOf('>')
      if (startIdx !== -1) {
        jsonStr = jsonStr.slice(startIdx + 1)
        // Remove closing tag if present
        jsonStr = jsonStr.replace(/<\/content>$/i, '')
      }
    } else if (jsonStr.includes('<content')) {
      // Content tag might be somewhere in the middle - extract first one
      const startMatch = jsonStr.match(/<content\s+thesys="true">/i)
      if (startMatch && startMatch.index !== undefined) {
        const startIdx = startMatch.index + startMatch[0].length
        const endIdx = jsonStr.indexOf('</content>', startIdx)
        if (endIdx !== -1) {
          jsonStr = jsonStr.slice(startIdx, endIdx)
        } else {
          jsonStr = jsonStr.slice(startIdx)
        }
      }
    }
    
    // Remove any remaining content tags (in case of duplicates)
    jsonStr = jsonStr.replace(/<\/?content[^>]*>/gi, '')
    
    // Unescape HTML entities
    jsonStr = jsonStr
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim()
    
    // Sometimes the response might have markdown code blocks
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    } else if (jsonStr.startsWith('```') && jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(3, -3).trim()
      if (jsonStr.startsWith('json')) {
        jsonStr = jsonStr.slice(4).trim()
      }
    }
    
    // Find the first valid JSON object in the string
    const jsonStartIdx = jsonStr.indexOf('{')
    if (jsonStartIdx > 0) {
      jsonStr = jsonStr.slice(jsonStartIdx)
    }
    
    // Find matching closing brace for the first object
    let braceCount = 0
    let jsonEndIdx = -1
    for (let i = 0; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') braceCount++
      if (jsonStr[i] === '}') braceCount--
      if (braceCount === 0 && jsonStr[i] === '}') {
        jsonEndIdx = i + 1
        break
      }
    }
    if (jsonEndIdx > 0) {
      jsonStr = jsonStr.slice(0, jsonEndIdx)
    }

    // Check if it's valid JSON with component structure
    if (jsonStr.includes('"component"') && jsonStr.includes('"props"')) {
      const parsed = JSON.parse(jsonStr)
      
      // Handle both {component: {...}} and {component: {component: "Card", props: {...}}}
      const rootComponent = parsed.component || parsed
      
      if (rootComponent && rootComponent.component) {
        return (
          <div className="thesys-ui p-1">
            {renderThesysComponent(rootComponent)}
          </div>
        )
      }
    }
  } catch (e) {
    // Not valid JSON, fall through to markdown rendering
    console.log('Thesys parse error:', e)
  }

  // Fallback: render as enhanced markdown
  return <MarkdownRenderer content={response} />
}

// Fallback markdown renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  
  return (
    <div className="prose prose-slate max-w-none">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-base font-semibold text-slate-700 mt-4 mb-2">{line.slice(4)}</h3>
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-lg font-semibold text-slate-800 mt-6 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-emerald-500 rounded-full" />
            {line.slice(3)}
          </h2>
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-xl font-bold text-slate-800 border-b border-emerald-200 pb-2 mb-4">{line.slice(2)}</h1>
        }
        
        // Lists
        if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
          const text = line.slice(2)
          const isWarning = text.toLowerCase().includes('concern') || text.toLowerCase().includes('caution')
          const isGood = text.toLowerCase().includes('good') || text.toLowerCase().includes('benefit')
          
          return (
            <div key={i} className={`flex items-start gap-2 p-2 rounded-lg my-1 ${
              isWarning ? 'bg-amber-50 border-l-2 border-amber-400' :
              isGood ? 'bg-emerald-50 border-l-2 border-emerald-400' :
              'bg-slate-50'
            }`}>
              {isWarning ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> :
               isGood ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> :
               <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />}
              <span className="text-slate-700">{text}</span>
            </div>
          )
        }
        
        // Bold text
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.*?)\*\*/g)
          return (
            <p key={i} className="text-slate-600 leading-relaxed my-2">
              {parts.map((part, j) => 
                j % 2 === 1 ? <strong key={j} className="font-semibold text-slate-800">{part}</strong> : part
              )}
            </p>
          )
        }
        
        // Empty lines
        if (line.trim() === '') return <br key={i} />
        
        // Regular paragraphs
        return <p key={i} className="text-slate-600 leading-relaxed my-2">{line}</p>
      })}
    </div>
  )
}

export default ThesysUIRenderer
export { ActionProvider }

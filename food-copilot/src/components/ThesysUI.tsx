'use client'

import React from 'react'
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
  Minus
} from 'lucide-react'

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

// Main renderer function
function renderThesysComponent(component: ThesysComponent): React.ReactNode {
  const { component: type, props } = component

  switch (type) {
    case 'Card':
      return <Card {...props} />
    case 'Header':
      return <Header {...props} />
    case 'DataTile':
      return <DataTile {...props} />
    case 'MiniCard':
      return <MiniCard {...props} />
    case 'MiniCardBlock':
      return <MiniCardBlock {...props} />
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
    default:
      console.warn(`Unknown Thesys component: ${type}`)
      return <div className="text-red-500">Unknown component: {type}</div>
  }
}

// Export the main component
export function ThesysUIRenderer({ response }: { response: string }) {
  // Try to parse as Thesys JSON response
  try {
    let jsonStr = response.trim()
    
    // Handle <content thesys="true"> wrapper from Thesys C1
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
    }
    
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

    // Check if it's valid JSON with component structure
    if (jsonStr.includes('"component"') && jsonStr.includes('"props"')) {
      const parsed = JSON.parse(jsonStr)
      
      // Handle both {component: {...}} and {component: {component: "Card", props: {...}}}
      const rootComponent = parsed.component || parsed
      
      if (rootComponent && rootComponent.component) {
        return (
          <div className="thesys-ui">
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

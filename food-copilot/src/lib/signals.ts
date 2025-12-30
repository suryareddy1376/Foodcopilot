// Signal Detection Pipeline
// Deterministic pattern detection before AI reasoning

export interface DetectedSignal {
  type: string
  severity: 'info' | 'caution' | 'concern'
  description: string
  evidence: string[]
}

export interface SignalDetectionResult {
  signals: DetectedSignal[]
  flaggedAdditives: FlaggedAdditive[]
  summary: {
    isUltraProcessed: boolean
    additiveCount: number
    hasDebatedIngredients: boolean
    novaGroup: number | null
    nutriScore: string | null
  }
}

export interface FlaggedAdditive {
  code: string
  name: string
  type: string
  concern: 'none' | 'mild' | 'moderate' | 'debated'
  reason?: string
}

// Additive taxonomy with concern levels
const ADDITIVE_DATABASE: Record<string, { name: string; type: string; concern: FlaggedAdditive['concern']; reason?: string }> = {
  // Colors (E100-E199) - NOVA 4 markers
  'e100': { name: 'Curcumin', type: 'colour', concern: 'none' },
  'e102': { name: 'Tartrazine', type: 'colour', concern: 'moderate', reason: 'May affect attention in children' },
  'e110': { name: 'Sunset Yellow', type: 'colour', concern: 'moderate', reason: 'May affect attention in children' },
  'e120': { name: 'Cochineal', type: 'colour', concern: 'mild', reason: 'Insect-derived, potential allergen' },
  'e129': { name: 'Allura Red', type: 'colour', concern: 'moderate', reason: 'May affect attention in children' },
  'e150a': { name: 'Caramel I', type: 'colour', concern: 'none' },
  'e150d': { name: 'Caramel IV', type: 'colour', concern: 'mild', reason: 'May contain 4-MEI' },
  'e171': { name: 'Titanium dioxide', type: 'colour', concern: 'debated', reason: 'Banned in EU since 2022' },
  
  // Preservatives (E200-E299)
  'e200': { name: 'Sorbic acid', type: 'preservative', concern: 'none' },
  'e211': { name: 'Sodium benzoate', type: 'preservative', concern: 'mild', reason: 'May form benzene with vitamin C' },
  'e220': { name: 'Sulphur dioxide', type: 'preservative', concern: 'mild', reason: 'May trigger reactions in sensitive individuals' },
  'e249': { name: 'Potassium nitrite', type: 'preservative', concern: 'debated', reason: 'IARC group 2A carcinogen in processed meat' },
  'e250': { name: 'Sodium nitrite', type: 'preservative', concern: 'debated', reason: 'IARC group 2A carcinogen in processed meat' },
  
  // Antioxidants (E300-E399) - Generally safe
  'e300': { name: 'Ascorbic acid (Vitamin C)', type: 'antioxidant', concern: 'none' },
  'e306': { name: 'Tocopherol (Vitamin E)', type: 'antioxidant', concern: 'none' },
  'e320': { name: 'BHA', type: 'antioxidant', concern: 'debated', reason: 'Potential endocrine disruptor' },
  'e321': { name: 'BHT', type: 'antioxidant', concern: 'debated', reason: 'Potential endocrine disruptor' },
  'e322': { name: 'Lecithin', type: 'emulsifier', concern: 'none' },
  'e330': { name: 'Citric acid', type: 'acidity regulator', concern: 'none' },
  
  // Emulsifiers/Thickeners (E400-E499) - NOVA 4 markers
  'e407': { name: 'Carrageenan', type: 'thickener', concern: 'debated', reason: 'Some studies suggest gut inflammation' },
  'e410': { name: 'Locust bean gum', type: 'thickener', concern: 'none' },
  'e412': { name: 'Guar gum', type: 'thickener', concern: 'none' },
  'e415': { name: 'Xanthan gum', type: 'thickener', concern: 'none' },
  'e440': { name: 'Pectin', type: 'gelling agent', concern: 'none' },
  'e450': { name: 'Diphosphates', type: 'stabiliser', concern: 'mild', reason: 'High phosphate intake may affect kidney health' },
  'e471': { name: 'Mono- and diglycerides', type: 'emulsifier', concern: 'none' },
  'e472e': { name: 'DATEM', type: 'emulsifier', concern: 'none' },
  'e476': { name: 'Polyglycerol polyricinoleate', type: 'emulsifier', concern: 'none' },
  
  // Acidity regulators (E500-E599)
  'e500': { name: 'Sodium bicarbonate', type: 'raising agent', concern: 'none' },
  'e503': { name: 'Ammonium carbonate', type: 'raising agent', concern: 'none' },
  
  // Flavor enhancers (E600-E699) - NOVA 4 markers
  'e620': { name: 'Glutamic acid', type: 'flavour enhancer', concern: 'mild', reason: 'Related to MSG' },
  'e621': { name: 'MSG', type: 'flavour enhancer', concern: 'debated', reason: 'Some individuals report sensitivity' },
  'e627': { name: 'Disodium guanylate', type: 'flavour enhancer', concern: 'mild', reason: 'Often used with MSG' },
  'e631': { name: 'Disodium inosinate', type: 'flavour enhancer', concern: 'mild', reason: 'Often used with MSG' },
  'e635': { name: "Disodium 5'-ribonucleotides", type: 'flavour enhancer', concern: 'mild', reason: 'Flavor enhancement system' },
  
  // Sweeteners (E900-E999) - NOVA 4 markers
  'e950': { name: 'Acesulfame K', type: 'sweetener', concern: 'mild', reason: 'Artificial sweetener' },
  'e951': { name: 'Aspartame', type: 'sweetener', concern: 'debated', reason: 'IARC "possibly carcinogenic" 2023' },
  'e952': { name: 'Cyclamate', type: 'sweetener', concern: 'debated', reason: 'Banned in US, allowed in EU' },
  'e954': { name: 'Saccharin', type: 'sweetener', concern: 'mild', reason: 'One of the oldest artificial sweeteners' },
  'e955': { name: 'Sucralose', type: 'sweetener', concern: 'mild', reason: 'Artificial sweetener' },
  'e960': { name: 'Steviol glycosides', type: 'sweetener', concern: 'none' },
  'e965': { name: 'Maltitol', type: 'sweetener', concern: 'none' },
  'e967': { name: 'Xylitol', type: 'sweetener', concern: 'none' },
  
  // Modified starches (E1000-E1599)
  'e1422': { name: 'Acetylated distarch adipate', type: 'modified starch', concern: 'none' },
  'e1442': { name: 'Hydroxypropyl distarch phosphate', type: 'modified starch', concern: 'none' },
}

// NOVA 4 marker types (ultra-processed indicators)
const NOVA4_MARKER_TYPES = new Set([
  'colour',
  'flavour enhancer',
  'sweetener',
  'emulsifier',
  'humectant',
  'glazing agent',
  'carbonating agent',
  'bulking agent'
])

// Parse additive code from OFF format (e.g., "en:e330" -> "e330")
function parseAdditiveCode(tag: string): string {
  return tag.replace('en:', '').toLowerCase()
}

export function detectSignals(
  ingredientsText: string | null,
  additivesTags: string[],
  novaGroup: number | null,
  nutriScore: string | null
): SignalDetectionResult {
  const signals: DetectedSignal[] = []
  const flaggedAdditives: FlaggedAdditive[] = []
  
  // Parse additives
  const parsedAdditives = additivesTags.map(parseAdditiveCode)
  
  // Look up each additive
  for (const code of parsedAdditives) {
    const info = ADDITIVE_DATABASE[code]
    if (info) {
      flaggedAdditives.push({
        code: code.toUpperCase(),
        name: info.name,
        type: info.type,
        concern: info.concern,
        reason: info.reason
      })
    } else {
      // Unknown additive
      flaggedAdditives.push({
        code: code.toUpperCase(),
        name: code.toUpperCase(),
        type: 'unknown',
        concern: 'none'
      })
    }
  }
  
  // Count types
  const emulsifierCount = flaggedAdditives.filter(a => a.type === 'emulsifier').length
  const preservativeCount = flaggedAdditives.filter(a => a.type === 'preservative').length
  const colourCount = flaggedAdditives.filter(a => a.type === 'colour').length
  const sweetenerCount = flaggedAdditives.filter(a => a.type === 'sweetener').length
  const flavourEnhancerCount = flaggedAdditives.filter(a => a.type === 'flavour enhancer').length
  const debatedCount = flaggedAdditives.filter(a => a.concern === 'debated').length
  
  // Signal: Ultra-processed (NOVA 4)
  if (novaGroup === 4) {
    signals.push({
      type: 'ultra_processed',
      severity: 'caution',
      description: 'Ultra-processed food (NOVA 4)',
      evidence: ['Classified as NOVA group 4 by Open Food Facts']
    })
  }
  
  // Signal: Multiple emulsifiers
  if (emulsifierCount >= 2) {
    signals.push({
      type: 'multiple_emulsifiers',
      severity: 'info',
      description: 'Multiple emulsifiers present',
      evidence: flaggedAdditives.filter(a => a.type === 'emulsifier').map(a => a.name)
    })
  }
  
  // Signal: Shelf-life engineering
  if (preservativeCount >= 2) {
    signals.push({
      type: 'shelf_life_engineered',
      severity: 'info',
      description: 'Engineered for extended shelf life',
      evidence: flaggedAdditives.filter(a => a.type === 'preservative').map(a => a.name)
    })
  }
  
  // Signal: Artificial colors
  if (colourCount >= 1) {
    const syntheticColors = flaggedAdditives.filter(
      a => a.type === 'colour' && ['e102', 'e110', 'e129'].includes(a.code.toLowerCase())
    )
    if (syntheticColors.length > 0) {
      signals.push({
        type: 'synthetic_colors',
        severity: 'caution',
        description: 'Contains synthetic colors',
        evidence: syntheticColors.map(a => `${a.code}: ${a.name}`)
      })
    }
  }
  
  // Signal: Artificial sweeteners
  if (sweetenerCount >= 1) {
    const artificialSweeteners = flaggedAdditives.filter(
      a => a.type === 'sweetener' && ['e950', 'e951', 'e952', 'e954', 'e955'].includes(a.code.toLowerCase())
    )
    if (artificialSweeteners.length > 0) {
      signals.push({
        type: 'artificial_sweeteners',
        severity: 'info',
        description: 'Contains artificial sweeteners',
        evidence: artificialSweeteners.map(a => `${a.code}: ${a.name}`)
      })
    }
  }
  
  // Signal: Flavor enhancement system
  if (flavourEnhancerCount >= 1) {
    signals.push({
      type: 'flavor_enhancement',
      severity: 'info',
      description: 'Uses flavor enhancement additives',
      evidence: flaggedAdditives.filter(a => a.type === 'flavour enhancer').map(a => a.name)
    })
  }
  
  // Signal: Debated ingredients
  if (debatedCount > 0) {
    signals.push({
      type: 'debated_ingredients',
      severity: 'concern',
      description: 'Contains ingredients under scientific debate',
      evidence: flaggedAdditives.filter(a => a.concern === 'debated').map(a => `${a.name}: ${a.reason}`)
    })
  }
  
  // Signal: High additive count
  if (parsedAdditives.length >= 6) {
    signals.push({
      type: 'high_additive_count',
      severity: 'info',
      description: `Contains ${parsedAdditives.length} additives`,
      evidence: [`Additive count: ${parsedAdditives.length}`]
    })
  }
  
  // Check for sugar as first ingredient
  if (ingredientsText) {
    const firstIngredient = ingredientsText.split(',')[0].toLowerCase().trim()
    const sugarTerms = ['sugar', 'sucrose', 'glucose', 'fructose', 'syrup', 'dextrose']
    if (sugarTerms.some(term => firstIngredient.includes(term))) {
      signals.push({
        type: 'sugar_first_ingredient',
        severity: 'caution',
        description: 'Sugar is the primary ingredient',
        evidence: [`First ingredient: ${firstIngredient}`]
      })
    }
  }
  
  // Check for palm oil
  if (ingredientsText?.toLowerCase().includes('palm oil') || 
      ingredientsText?.toLowerCase().includes('palm fat')) {
    signals.push({
      type: 'palm_oil_present',
      severity: 'info',
      description: 'Contains palm oil',
      evidence: ['Palm oil detected in ingredients']
    })
  }
  
  return {
    signals,
    flaggedAdditives,
    summary: {
      isUltraProcessed: novaGroup === 4,
      additiveCount: parsedAdditives.length,
      hasDebatedIngredients: debatedCount > 0,
      novaGroup,
      nutriScore
    }
  }
}

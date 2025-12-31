'use client'

import { useState } from 'react'
import { X, Check, Loader2, Leaf, AlertTriangle, Save } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { DIETARY_RESTRICTIONS, COMMON_ALLERGENS } from '@/lib/supabase'

interface UserPreferencesProps {
  isOpen: boolean
  onClose: () => void
}

export default function UserPreferences({ isOpen, onClose }: UserPreferencesProps) {
  const { profile, updateProfile } = useAuth()
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
    profile?.dietary_restrictions || []
  )
  const [allergens, setAllergens] = useState<string[]>(
    profile?.allergens || []
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const toggleDietaryRestriction = (id: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
    setSaveSuccess(false)
  }

  const toggleAllergen = (id: string) => {
    setAllergens(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    const { error } = await updateProfile({
      dietary_restrictions: dietaryRestrictions,
      allergens: allergens
    })

    setIsSaving(false)
    if (!error) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const hasChanges = 
    JSON.stringify(dietaryRestrictions.sort()) !== JSON.stringify((profile?.dietary_restrictions || []).sort()) ||
    JSON.stringify(allergens.sort()) !== JSON.stringify((profile?.allergens || []).sort())

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
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Your Preferences</h2>
          <p className="mt-1 text-emerald-100 text-sm">
            Set your dietary needs and allergens for personalized analysis
          </p>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dietary Restrictions */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">Dietary Restrictions</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DIETARY_RESTRICTIONS.map((diet) => (
                <button
                  key={diet.id}
                  onClick={() => toggleDietaryRestriction(diet.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    dietaryRestrictions.includes(diet.id)
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-sm ${
                      dietaryRestrictions.includes(diet.id) ? 'text-emerald-700' : 'text-slate-700'
                    }`}>
                      {diet.label}
                    </span>
                    {dietaryRestrictions.includes(diet.id) && (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    {diet.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-slate-800">Allergens to Flag</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              We'll highlight any products containing these allergens
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_ALLERGENS.map((allergen) => (
                <button
                  key={allergen.id}
                  onClick={() => toggleAllergen(allergen.id)}
                  className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                    allergens.includes(allergen.id)
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50/50'
                  }`}
                  title={'examples' in allergen ? `Includes: ${allergen.examples}` : undefined}
                >
                  {allergens.includes(allergen.id) && (
                    <Check className="w-3.5 h-3.5 inline mr-1.5" />
                  )}
                  {allergen.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> When you scan a product, we'll check if it contains 
              any of your allergens or violates your dietary restrictions and highlight them 
              prominently in the analysis.
            </p>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {dietaryRestrictions.length} restrictions • {allergens.length} allergens
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                saveSuccess
                  ? 'bg-green-500 text-white'
                  : hasChanges
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/25'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

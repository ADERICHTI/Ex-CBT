import { AI_FEATURES } from '../ai/catalog.js'

const TIER_LABEL = { quick: 'Quick', standard: 'Standard', best: 'Best' }

const SUITE_FEATURE_LABELS = {
  'create-test': 'Create a test with AI',
  'review-test': 'Review a test with AI',
  'analyse-test-results': 'Analyse test results with AI',
  'edit-test': 'Edit a test with AI',
  'generate-form': 'Create a form with AI',
  'edit-form': 'Edit a form with AI',
  'design-screens': 'Design screens with AI',
  'edit-screen': 'Change a screen with AI',
}

// What a ledger entry was, in words.
export function entryLabel(e) {
  switch (e.type) {
    case 'starter':
      return 'Welcome credits'
    case 'topup':
      return `Top-up · ${e.note ?? 'pack'}`
    case 'charge': {
      const label = AI_FEATURES[e.feature]?.label ?? SUITE_FEATURE_LABELS[e.feature] ?? 'AI'
      return `${label}${e.tier ? ` · ${TIER_LABEL[e.tier]}` : ''}`
    }
    case 'grant':
      return e.note ? `Credit from HyperCBT · ${e.note}` : 'Credit from HyperCBT'
    case 'adjustment':
      return e.note ? `Adjustment · ${e.note}` : 'Adjustment'
    case 'refund':
      return 'Refund'
    case 'chargeback':
      return 'Chargeback'
    case 'expiry':
      return 'Credits expired (no top-up for 12 months)'
    default:
      return e.type
  }
}

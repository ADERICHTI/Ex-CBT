// HyperCBT's AI features, for the app's "≈ X credits" hints and hold
// estimates. COPY of peraform/functions/ai/hypercbt-catalog.js (the shared
// aiRun uses that one) - keep the two in step. The helpers below mirror
// peraform/functions/ai/catalog.js.

import { holdFor } from '../credits/pricing.js'

export const AI_FEATURES = {
  // A whole multiple-choice test: from a short description (topic, level,
  // how many questions) or from pasted notes / a syllabus. Every question
  // comes with its correct answer, a one-sentence explanation and a
  // difficulty (easy / medium / hard).
  'create-test': {
    app: 'hypercbt',
    label: 'Create a test with AI',
    tiers: ['quick', 'standard', 'best'],
    defaultTier: 'standard',
    maxChars: { describe: 2000, notes: 30000 },
    // ~90 output tokens a question (text, 4 options, answer, explanation,
    // difficulty), so up to ~60 questions from notes.
    maxTokens: { describe: 6000, notes: 8000 },
    minTokens: { describe: 3000, notes: 4000 },
    overheadTokens: 1000,
    // 10 questions from a short description.
    typical: { inputTokens: 900, outputTokens: 1500 },
  },
  // Review before publishing: reads the test (questions, options, the
  // marked answers) and suggests fixes - unclear wording, a doubtful
  // answer, two right options, weak wrong options, spelling. Read-only: the
  // app shows each suggestion with its own Apply button.
  'review-test': {
    app: 'hypercbt',
    label: 'Review a test with AI',
    tiers: ['quick', 'standard', 'best'],
    defaultTier: 'standard',
    maxChars: { review: 500 }, // what to focus on (optional)
    maxTestChars: 40000, // the test, as compact JSON
    maxTokens: { review: 5000 },
    minTokens: { review: 2000 },
    overheadTokens: 1100,
    typical: { inputTokens: 2000, outputTokens: 1200 },
  },
}

// Input tokens for a run (what holds are sized on, here and on the server).
export function inputTokensFor(feature, chars) {
  return Math.ceil(chars / 3) + AI_FEATURES[feature].overheadTokens
}

// The least and the most a run reserves, before knowing the balance.
export function holdRange(billing, feature, tier, mode, chars) {
  const f = AI_FEATURES[feature]
  const model = billing.tiers[tier]
  const input = inputTokensFor(feature, chars)
  return {
    min: holdFor(billing, model, input, f.minTokens[mode]),
    max: holdFor(billing, model, input, f.maxTokens[mode]),
  }
}

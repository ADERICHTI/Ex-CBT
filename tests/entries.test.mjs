import test from 'node:test'
import assert from 'node:assert/strict'
import { entryLabel } from '../src/features/credits/entries.js'

test('entryLabel for starter credits', () => {
  assert.equal(entryLabel({ type: 'starter' }), 'Welcome credits')
})

test('entryLabel for topup', () => {
  assert.equal(entryLabel({ type: 'topup', note: 'Standard pack' }), 'Top-up · Standard pack')
  assert.equal(entryLabel({ type: 'topup' }), 'Top-up · pack')
})

test('entryLabel for AI charges', () => {
  assert.equal(
    entryLabel({ type: 'charge', feature: 'create-test', tier: 'standard' }),
    'Create a test with AI · Standard',
  )
  assert.equal(
    entryLabel({ type: 'charge', feature: 'analyse-test-results' }),
    'Analyse test results with AI',
  )
  assert.equal(
    entryLabel({ type: 'charge', feature: 'generate-form', tier: 'quick' }),
    'Create a form with AI · Quick',
  )
})

test('entryLabel for grants mentioning HyperCBT', () => {
  assert.equal(entryLabel({ type: 'grant', note: 'Promo' }), 'Credit from HyperCBT · Promo')
  assert.equal(entryLabel({ type: 'grant' }), 'Credit from HyperCBT')
})

test('entryLabel for refunds, adjustments, chargebacks, expiry', () => {
  assert.equal(entryLabel({ type: 'refund' }), 'Refund')
  assert.equal(entryLabel({ type: 'adjustment', note: 'Sync' }), 'Adjustment · Sync')
  assert.equal(entryLabel({ type: 'chargeback' }), 'Chargeback')
  assert.equal(entryLabel({ type: 'expiry' }), 'Credits expired (no top-up for 12 months)')
})

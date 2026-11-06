import test from 'node:test'
import assert from 'node:assert/strict'
import { difficultyStats } from '../src/lib/difficultyStats.js'

test('returns null when stats is missing or empty', () => {
  assert.equal(difficultyStats(null, ['easy']), null)
  assert.equal(difficultyStats({}, ['easy']), null)
  assert.equal(difficultyStats({ questions: [] }, []), null)
})

test('returns null when no question has a difficulty', () => {
  const stats = {
    count: 5,
    questions: [
      { n: 1, correctRate: 0.8 },
      { n: 2, correctRate: 0.6 },
    ],
  }
  assert.equal(difficultyStats(stats, ['', '']), null)
  assert.equal(difficultyStats(stats, []), null)
  assert.equal(difficultyStats(stats, ['unknown', 'other']), null)
})

test('groups by level and omits empty levels', () => {
  const stats = {
    count: 10,
    questions: [
      { n: 1, correctRate: 0.8 },
      { n: 2, correctRate: 0.6 },
      { n: 3, correctRate: 0.4 },
    ],
  }
  const difficulties = ['easy', 'easy', 'hard'] // no medium
  const res = difficultyStats(stats, difficulties)

  assert.ok(res)
  assert.equal(res.levels.length, 2)

  const [easy, hard] = res.levels
  assert.equal(easy.key, 'easy')
  assert.equal(easy.label, 'Easy')
  assert.equal(easy.count, 2)
  assert.equal(easy.average, 70) // (0.8 + 0.6) / 2 = 70%

  assert.equal(hard.key, 'hard')
  assert.equal(hard.label, 'Hard')
  assert.equal(hard.count, 1)
  assert.equal(hard.average, 40)
})

test('handles count = 0 gracefully', () => {
  const stats = {
    count: 0,
    questions: [
      { n: 1, correctRate: null },
      { n: 2, correctRate: null },
    ],
  }
  const res = difficultyStats(stats, ['easy', 'medium'])
  assert.ok(res)
  assert.equal(res.levels[0].average, null)
  assert.equal(res.surprises.length, 0)
})

test('finds surprises: Easy under 50% and Hard over 90%', () => {
  const stats = {
    count: 10,
    questions: [
      { n: 1, correctRate: 0.8 }, // Easy, normal (80%)
      { n: 2, correctRate: 0.3 }, // Easy under 50% -> surprise!
      { n: 3, correctRate: 0.5 }, // Medium, 50%
      { n: 4, correctRate: 0.95 }, // Hard over 90% -> surprise!
      { n: 5, correctRate: 0.2 }, // Hard, normal (20%)
    ],
  }
  const difficulties = ['easy', 'easy', 'medium', 'hard', 'hard']
  const res = difficultyStats(stats, difficulties)

  assert.ok(res)
  assert.deepEqual(res.surprises, [
    'Question 2 is marked Easy, but only 30% got it right',
    'Question 4 is marked Hard, but 95% got it right',
  ])
})

test('no surprises when thresholds are not crossed', () => {
  const stats = {
    count: 10,
    questions: [
      { n: 1, correctRate: 0.5 }, // Easy, exactly 50% (not under 50%)
      { n: 2, correctRate: 0.9 }, // Hard, exactly 90% (not over 90%)
    ],
  }
  const res = difficultyStats(stats, ['easy', 'hard'])
  assert.ok(res)
  assert.equal(res.surprises.length, 0)
})

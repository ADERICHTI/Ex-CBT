// Summary statistics grouped by question difficulty (Easy, Medium, Hard).
// Works from testStats(...) output and the test's difficulty list
// (from the answer key: getAnswerKey(testId).difficulty).
//
// Pure, no imports or I/O.

const norm = (v) => String(v ?? '').trim().toLowerCase()

const LEVELS = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
]

export function difficultyStats(stats, difficulty = []) {
  if (!stats || !Array.isArray(stats.questions)) return null

  const getDiff = (q, i) => norm(difficulty[i] ?? q?.difficulty)

  // Hide the card when no question has a difficulty set.
  const hasAny = stats.questions.some((q, i) => ['easy', 'medium', 'hard'].includes(getDiff(q, i)))
  if (!hasAny) return null

  const levels = []
  for (const lvl of LEVELS) {
    const inLevel = stats.questions.filter((q, i) => getDiff(q, i) === lvl.key)
    if (inLevel.length === 0) continue

    let average = null
    if (stats.count > 0) {
      const sum = inLevel.reduce((acc, q) => acc + (q.correctRate ?? 0), 0)
      average = Math.round((sum / inLevel.length) * 100)
    }

    levels.push({
      key: lvl.key,
      label: lvl.label,
      count: inLevel.length,
      average,
    })
  }

  if (levels.length === 0) return null

  const surprises = []
  if (stats.count > 0) {
    stats.questions.forEach((q, i) => {
      const d = getDiff(q, i)
      if (q.correctRate == null) return
      const pct = Math.round(q.correctRate * 100)
      if (d === 'easy' && q.correctRate < 0.5) {
        surprises.push(`Question ${q.n} is marked Easy, but only ${pct}% got it right`)
      } else if (d === 'hard' && q.correctRate > 0.9) {
        surprises.push(`Question ${q.n} is marked Hard, but ${pct}% got it right`)
      }
    })
  }

  return {
    levels,
    surprises,
  }
}

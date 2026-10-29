// Applying a "Review with AI" suggestion to a question (ReviewDialog.jsx).

// What a suggestion would make the question: its new text and options, and
// which option is correct. null when it no longer fits (e.g. the question
// was deleted since the review).
export function applied(q, s) {
  if (!q) return null
  const options = s.options ?? q.options
  let correct = q.correct
  if (s.answerIndex != null) correct = s.answerIndex < options.length ? s.answerIndex : null
  else if (s.options && q.correct != null) {
    // New options without a new answer: keep the same answer if it's still there.
    const old = q.options[q.correct]?.trim().toLowerCase()
    const at = options.findIndex((o) => o.trim().toLowerCase() === old)
    correct = at >= 0 ? at : null
  }
  return { question: s.question ?? q.question, options, correct }
}

export const hasFix = (s) => s.question != null || s.options != null || s.answerIndex != null

// Keep: a person's saved items, shared by every Quality Tools app (stored
// in the suite-wide "suite" database: keeps/{uid}/items/{id}; rules in
// peraform/firestore.suite.rules). A copy of PeraForm's lib/keep.js with
// HyperCBT's own kind: text and links work everywhere; questions are
// HyperCBT's (PeraForm's fields and design blocks don't show here).
//
// Item = { kind, app (null = every app), label, payload (JSON string of
// the kind's data), createdAt }
//   text      { text }
//   link      { url }
//   question  { question, options, correct, explanation, difficulty } — HyperCBT

export const APP = 'hypercbt'

export const KEEP_KINDS = {
  question: { label: 'Questions', app: APP, where: 'Paste on a test’s Questions tab; it goes at the end.' },
  text: { label: 'Text', app: null, where: 'Paste as a new question (its wording), or copy it.' },
  link: { label: 'Links', app: null, where: 'Paste as a new question, or copy it.' },
}

// Items this app can show: its own kinds and the suite-wide ones.
export const visibleHere = (item) => !item.app || item.app === APP

export function readPayload(item) {
  try {
    return JSON.parse(item.payload)
  } catch {
    return null
  }
}

const LINK = /^https?:\/\/\S+$/i

// A new item for the store. JSON keeps undefined values and nested
// arrays out of Firestore's way.
export function makeKeep(kind, data, label) {
  return { kind, app: KEEP_KINDS[kind]?.app ?? null, label: String(label || 'Untitled').slice(0, 200), payload: JSON.stringify(data) }
}

// Text typed or pasted into the Keep: a link when it's just an address.
export function keepText(text) {
  const t = String(text ?? '').trim()
  if (!t) return null
  if (LINK.test(t)) return makeKeep('link', { url: t }, t)
  return makeKeep('text', { text: t.slice(0, 20000) }, t.split('\n')[0].slice(0, 80))
}

// A test question (from the editor's draft) as a kept question, with its
// correct answer, explanation and difficulty.
export function keepQuestion(q) {
  const { question = '', options = [], correct = null, explanation = '', difficulty = '' } = q
  return makeKeep('question', { question, options, correct, explanation, difficulty }, question.trim() || 'Untitled question')
}

const LETTERS = 'ABCDEFGH'

// A short line under an item's label in the Keep list.
export function keepSummary(item) {
  const data = readPayload(item)
  if (!data) return ''
  if (item.kind === 'text') return data.text.length > 80 ? `${data.text.slice(0, 80)}…` : data.text
  if (item.kind === 'link') return data.url
  if (item.kind === 'question') {
    const n = data.options?.length ?? 0
    const answer = data.correct != null && data.correct < n ? ` · answer ${LETTERS[data.correct]}` : ' · no answer marked'
    return `${n} option${n === 1 ? '' : 's'}${answer}${data.difficulty ? ` · ${data.difficulty}` : ''}`
  }
  return ''
}

// Kept text or a link as a new question: its wording, with empty options.
export function textAsQuestion(data) {
  return { question: (data.url ?? data.text ?? '').slice(0, 2000), options: ['', '', '', ''], correct: null, explanation: '', difficulty: '' }
}

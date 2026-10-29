import { useEffect, useMemo } from 'react'
import { ArrowLeft, Clock, Lock } from 'lucide-react'
import TestThumbnail from './TestThumbnail.jsx'
import { CATEGORIES, TEMPLATE_BY_KEY, TEMPLATES, useRecentTemplateKeys } from './templates.js'
import './TemplateGallery.css'

// Full-page gallery of starter tests, grouped like PeraForm's; picking one
// creates a draft from it (the dashboard does the creating).
export default function TemplateGallery({ open, email, onClose, onPick, creating }) {
  const recentKeys = useRecentTemplateKeys(email)
  const recents = useMemo(() => recentKeys.map((k) => TEMPLATE_BY_KEY[k]).filter(Boolean), [recentKeys])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="gallery-overlay" role="dialog" aria-modal="true" aria-label="Template gallery">
      <div className="gallery-sheet">
        <header className="gallery-head">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to dashboard">
            <ArrowLeft size={20} />
          </button>
          <h1>Template gallery</h1>
        </header>
        <p className="gallery-intro">
          Each template is a draft with sample questions and their answers marked. Change anything before you
          publish it.
        </p>

        {recents.length > 0 && <Section title="Recently used" items={recents} onPick={onPick} creating={creating} />}
        {CATEGORIES.map((cat) => (
          <Section
            key={cat.id}
            title={cat.title}
            items={TEMPLATES.filter((t) => t.category === cat.id)}
            onPick={onPick}
            creating={creating}
          />
        ))}
      </div>
    </div>
  )
}

function Section({ title, items, onPick, creating }) {
  return (
    <section className="gallery-section" aria-label={title}>
      <h2>{title}</h2>
      <div className="gallery-grid">
        {items.map((t) => (
          <button
            key={t.key}
            type="button"
            className="start-card gallery-card"
            onClick={() => onPick(t)}
            disabled={creating}
            aria-label={`Start with the ${t.name} template`}
          >
            <span className="start-visual gallery-visual">
              <TestThumbnail title={t.preview.displayName} questions={t.preview.questions} />
            </span>
            <span className="start-label">{t.name}</span>
            <span className="gallery-meta">
              <Clock size={13} /> {t.minutes} min · {t.count} questions
              {t.strictMode && (
                <>
                  {' · '}
                  <Lock size={13} /> strict
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

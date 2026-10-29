// Miniature of a test's first questions - the dashboard card preview.
export default function TestThumbnail({ title, questions = [] }) {
  return (
    <div className="thumb" aria-hidden="true">
      <div className="thumb-sheet">
        <div className="thumb-block thumb-title">{title || 'Untitled test'}</div>
        {questions.slice(0, 3).map((q, i) => (
          <div key={q.id ?? i} className="thumb-block">
            <span>{q.question || 'Untitled question'}</span>
            {q.options.slice(0, 2).map((o, j) => (
              <span key={j} className="thumb-option">
                {o}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

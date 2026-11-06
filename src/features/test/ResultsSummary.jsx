import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CircleCheck, CircleSlash, Info } from 'lucide-react'
import { MIN_FOR_GROUPS } from '../../lib/resultStats.js'
import { difficultyStats } from '../../lib/difficultyStats.js'
import DawnOrb from '../ai/DawnOrb.jsx'

const pct = (rate) => (rate == null ? '-' : `${Math.round(rate * 100)}%`)

// Flags come from the numbers alone (lib/resultStats.js); each has an icon
// and words, never colour alone.
const FLAGS = {
  'too-easy': { label: 'Too easy', icon: ArrowDown, tone: 'neutral', help: '90% or more got it right, so it doesn’t tell candidates apart.' },
  'too-hard': { label: 'Too hard', icon: ArrowUp, tone: 'warn', help: '30% or fewer got it right - worth reteaching, or checking the question.' },
  'unused-option': { label: 'Unused option', icon: CircleSlash, tone: 'neutral', help: 'A wrong option nobody picked isn’t working as a distractor.' },
  'possible-problem': {
    label: 'Check this question',
    icon: AlertTriangle,
    tone: 'bad',
    help: 'Weaker candidates did better on it than stronger ones - the wording or the marked answer may be faulty.',
  },
}

// Results → Summary: headline numbers, the spread of scores, and each
// question's picks. `stats` is lib/resultStats.js → testStats().
export default function ResultsSummary({ stats, difficulty, onAnalyse }) {
  const diffStats = difficultyStats(stats, difficulty)

  return (
    <div className="tab-stack">
      <section className="stats" aria-label="Summary">
        <div className="stat">
          <strong>{stats.count}</strong>
          <span>submitted</span>
        </div>
        <div className="stat">
          <strong>{stats.average}%</strong>
          <span>average</span>
        </div>
        <div className="stat">
          <strong>{stats.median}%</strong>
          <span>median</span>
        </div>
        <div className="stat">
          <strong>
            {stats.lowest}–{stats.highest}%
          </strong>
          <span>lowest–highest</span>
        </div>
      </section>

      <section className="panel analyse-cta">
        <span>
          <strong>Make sense of the results</strong>
          <small>
            A plain-language report on how the test went and which questions need attention. Only totals are sent -
            never names or anyone’s own answers.
          </small>
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAnalyse}>
          <DawnOrb size={18} /> Analyse with Dawn
        </button>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Spread of scores</h2>
        </header>
        <ScoreChart bands={stats.bands} count={stats.count} />
      </section>

      {diffStats && (
        <section className="panel" aria-label="Results by difficulty">
          <header className="panel-head">
            <h2>By difficulty</h2>
          </header>
          <ul className="opt-bars difficulty-bars">
            {diffStats.levels.map((lvl) => (
              <li key={lvl.key}>
                <span className="opt-label">
                  <strong>{lvl.label}</strong>
                  <small className="take-muted">
                    ({lvl.count} {lvl.count === 1 ? 'question' : 'questions'})
                  </small>
                </span>
                <span className="opt-track" aria-hidden="true">
                  <span className="opt-bar" style={{ width: `${lvl.average ?? 0}%` }} />
                </span>
                <span className="opt-count">{lvl.average == null ? '-' : `${lvl.average}%`}</span>
              </li>
            ))}
          </ul>
          {diffStats.surprises.length > 0 && (
            <ul className="difficulty-surprises">
              {diffStats.surprises.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {stats.count < MIN_FOR_GROUPS && (
        <p className="take-muted results-note">
          <Info size={14} /> With fewer than {MIN_FOR_GROUPS} results, treat these numbers as a rough guide.
        </p>
      )}

      {stats.questions.map((q) => (
        <QuestionStats key={q.id} q={q} count={stats.count} groups={stats.groups} />
      ))}
    </div>
  )
}

// Score bands as a column chart: one hue, thin columns with rounded tops on
// a baseline, values on hover/focus (and in the table for screen readers).
function ScoreChart({ bands, count }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...bands.map((b) => b.count))
  const busiest = bands.reduce((best, b, i) => (b.count > bands[best].count ? i : best), 0)
  return (
    <figure className="score-chart">
      <div className="score-plot" onMouseLeave={() => setHover(null)}>
        {bands.map((b, i) => (
          <button
            key={b.from}
            type="button"
            className="score-col"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${b.from}–${b.to}%: ${b.count} candidate${b.count === 1 ? '' : 's'}`}
          >
            {/* Direct label only on the busiest band. */}
            {i === busiest && b.count > 0 && <span className="score-value">{b.count}</span>}
            <span className="score-bar" style={{ height: `${(b.count / max) * 100}%` }} />
            {hover === i && (
              <span className="chart-tip" role="tooltip">
                <strong>
                  {b.from}–{b.to}%
                </strong>
                {b.count} of {count} candidate{count === 1 ? '' : 's'}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="score-axis" aria-hidden="true">
        {bands.map((b) => (
          <span key={b.from}>{b.from}</span>
        ))}
      </div>
      <figcaption className="take-muted">Score (%) - how many candidates scored in each band</figcaption>
      <table className="sr-only">
        <caption>Spread of scores</caption>
        <thead>
          <tr>
            <th>Score</th>
            <th>Candidates</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.from}>
              <td>
                {b.from}–{b.to}%
              </td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function QuestionStats({ q, count, groups }) {
  const most = Math.max(1, ...q.options.map((o) => o.count))
  return (
    <section className="panel q-stats" aria-label={`Question ${q.n} results`}>
      <header className="q-stats-head">
        <span className="q-num">{q.n}</span>
        <p className="q-stats-text">{q.question}</p>
        <span className="q-stats-rate">
          <strong>{pct(q.correctRate)}</strong> right
        </span>
      </header>

      <ul className="opt-bars">
        {q.options.map((o, i) => (
          <li key={i} className={o.correct ? 'is-correct' : ''}>
            <span className="opt-label">
              {o.correct && <CircleCheck size={14} aria-hidden="true" />}
              {o.text}
              {o.correct && <em>Correct</em>}
            </span>
            <span className="opt-track" aria-hidden="true">
              <span className="opt-bar" style={{ width: `${(o.count / most) * 100}%` }} />
            </span>
            <span className="opt-count">
              {o.count} <small>{count ? `${Math.round((o.count / count) * 100)}%` : ''}</small>
            </span>
          </li>
        ))}
      </ul>

      <footer className="q-stats-foot">
        {q.noAnswer > 0 && <span className="take-muted">{q.noAnswer} left it blank</span>}
        {groups && (
          <span className="take-muted">
            Top group {pct(q.strongRate)} right · bottom group {pct(q.weakRate)}
          </span>
        )}
        {q.flags.map((f) => {
          const flag = FLAGS[f]
          const Icon = flag.icon
          return (
            <span key={f} className={`flag flag-${flag.tone}`} title={flag.help}>
              <Icon size={13} aria-hidden="true" /> {flag.label}
            </span>
          )
        })}
      </footer>
    </section>
  )
}

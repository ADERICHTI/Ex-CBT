import { Link } from 'react-router-dom'
import {
  BarChart3,
  FileCheck2,
  FolderInput,
  Link2,
  MoreVertical,
  PencilLine,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import MenuButton from '../../lib/MenuButton.jsx'
import { timeAgo } from '../../lib/timeAgo.js'
import { STATUS_LABELS } from '../../services/firestore.js'
import TestThumbnail from './TestThumbnail.jsx'

// One test in "Recent tests", as a grid card or a list row. The title link
// stretches over the whole card, so the menu button isn't nested in a link.
export default function TestCard({ test, view, starred, onToggleStar, onMove, onOpen, onCopyLink, onDelete }) {
  const status = test.status ?? 'draft'
  const actions = [
    { label: 'Open', icon: PencilLine, onSelect: () => onOpen(test.id, 'questions') },
    { label: 'Candidates', icon: Users, onSelect: () => onOpen(test.id, 'candidates') },
    { label: 'Results', icon: BarChart3, onSelect: () => onOpen(test.id, 'results') },
  ]
  if (status !== 'draft') actions.push({ label: 'Copy link', icon: Link2, onSelect: () => onCopyLink(test.id) })
  actions.push({ label: 'Move to folder…', icon: FolderInput, onSelect: () => onMove(test) })
  actions.push({ label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(test) })

  const star = (
    <button
      type="button"
      className={`icon-btn star-btn card-star${starred ? ' on' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleStar(test.id, !starred)
      }}
      aria-label={starred ? 'Unstar' : 'Star'}
      aria-pressed={starred}
      title={starred ? 'Starred' : 'Star'}
    >
      <Star size={16} />
    </button>
  )

  const submitted = test.submissionCount ?? 0
  const meta = (
    <>
      <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>
      {submitted > 0 && <span>{submitted} submitted</span>}
      <span>Edited {timeAgo(test.updatedAt)}</span>
    </>
  )
  const title = test.displayName || 'Untitled test'
  const href = `/tests/${test.id}/questions`

  if (view === 'list') {
    return (
      <div className="test-row">
        <FileCheck2 size={18} className="test-row-icon" />
        <Link to={href} className="test-link test-row-title">
          {title}
        </Link>
        <span className="test-row-owner">{test.questions?.length ?? 0} questions</span>
        <span className="test-meta">{meta}</span>
        {star}
        <MenuButton icon={<MoreVertical size={18} />} label="Test actions" items={actions} />
      </div>
    )
  }

  return (
    <div className="test-card">
      <TestThumbnail title={test.displayName} questions={test.questions} />
      <div className="test-card-info">
        <div className="test-card-text">
          <Link to={href} className="test-link test-card-title">
            {title}
          </Link>
          <span className="test-meta">{meta}</span>
        </div>
        {star}
        <MenuButton icon={<MoreVertical size={18} />} label="Test actions" items={actions} />
      </div>
    </div>
  )
}

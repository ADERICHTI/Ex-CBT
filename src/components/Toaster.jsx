const ICONS = {
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
}

// Bottom-centre pills, like PeraForm's toasts (lib/useToast.jsx).
export default function Toaster({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    <div className="toaster" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toaster-item toaster-${t.type}`}>
          <i className={`fa-solid ${ICONS[t.type] ?? ICONS.info}`} aria-hidden="true"></i>
          <span>{t.message}</span>
          <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      ))}
    </div>
  )
}

// Shown in place of a blank screen while auth/route/data guards are resolving.
export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="app-loading" role="status">
      <div className="app-loading-spinner" />
      <span>{label}</span>
    </div>
  )
}

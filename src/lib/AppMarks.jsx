import { useId } from 'react'

// Marks of the other Quality Tools apps, for the app switcher.

// The suite mark: two sparkles in the Quality Tools spectrum.
export function QtMark({ size = 20 }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="12" y1="12" x2="38" y2="38">
          <stop offset="0" stopColor="#ff6b8b" />
          <stop offset="0.3" stopColor="#ffb347" />
          <stop offset="0.55" stopColor="#3ddc97" />
          <stop offset="0.78" stopColor="#3fa9ff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M21 9c1.2 7.6 4.4 10.8 12 12-7.6 1.2-10.8 4.4-12 12-1.2-7.6-4.4-10.8-12-12 7.6-1.2 10.8-4.4 12-12z"
      />
      <path fill={`url(#${id})`} d="M34 27c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6z" />
    </svg>
  )
}

// PeraForm's mark (same art as peraform/src/lib/LogoMark.jsx).
export function PeraFormMark({ size = 20 }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#818cf8" stopOpacity="0" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <g transform="skewX(-12) translate(6 0)">
        <rect x="10" y="7" width="30" height="9" rx="4.5" fill={`url(#${id}-f)`} />
        <rect x="10" y="19.5" width="30" height="9" rx="4.5" fill="#6366f1" />
        <rect x="10" y="32" width="30" height="9" rx="4.5" fill="#a5b4fc" />
        <circle cx="15" cy="11.5" r="2.2" fill="#fff" />
        <circle cx="15" cy="24" r="2.2" fill="#fff" />
        <circle cx="15" cy="36.5" r="2.2" fill="#fff" />
      </g>
      <rect x="1" y="10.5" width="9" height="2" rx="1" fill={`url(#${id}-s)`} />
      <rect x="3" y="23" width="7" height="2" rx="1" fill={`url(#${id}-s)`} />
    </svg>
  )
}

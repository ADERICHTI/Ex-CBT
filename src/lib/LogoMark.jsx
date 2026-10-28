// HyperCBT mark: three answer rows leaning forward (hyper), the bottom one
// chosen - a filled bubble with a tick (CBT). Colours from the Quality Tools
// spectrum, with HyperCBT's orange-amber on the chosen answer. Same art as
// public/favicon.svg.
export default function LogoMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <g transform="skewX(-10) translate(5 0)">
        <circle cx="12" cy="10.5" r="4.5" fill="#3fa9ff" />
        <rect x="7.5" y="18.5" width="22" height="9" rx="4.5" fill="#3ddc97" />
        <rect x="12" y="31.5" width="31" height="10" rx="5" fill="#ffb347" />
        <circle cx="13" cy="36.5" r="7.5" fill="#ea7a10" />
        <path
          d="M9.6 36.6l2.4 2.4 4.6-4.8"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

import { Sparkles } from 'lucide-react'
import { formatCredits } from './pricing.js'
import { useWallet } from './walletContext.js'

// The shared Quality Tools credits page (top-ups, history, invoices). It
// lives in PeraForm for now; the same credits work in every QT app.
export const CREDITS_URL = 'https://peraform-qt.web.app/credits'

// Top-bar AI credit balance; opens the credits page in a new tab.
export default function BalanceChip() {
  const { wallet, spendable, loaded, billing } = useWallet()
  if (!loaded) return null
  const low = !wallet || spendable < billing.lowBalanceMillicredits
  return (
    <a
      href={CREDITS_URL}
      target="_blank"
      rel="noopener"
      className={`credit-chip${low ? ' credit-chip-low' : ''}`}
      title="Quality Tools AI credits (top up, history)"
      aria-label={`${formatCredits(spendable)} AI credits - open the credits page`}
    >
      <Sparkles size={16} />
      <span>{formatCredits(spendable)}</span>
    </a>
  )
}

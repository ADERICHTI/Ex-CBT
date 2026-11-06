import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { formatCredits } from './pricing.js'
import { useWallet } from './walletContext.js'

// HyperCBT AI credits page (top-ups, history, invoices).
export const CREDITS_URL = '/credits'

// Top-bar credit balance; opens the Credits page.
export default function BalanceChip() {
  const { wallet, spendable, loaded, billing } = useWallet()
  if (!loaded) return null
  const low = !wallet || spendable < billing.lowBalanceMillicredits
  return (
    <Link
      to="/credits"
      className={`credit-chip${low ? ' credit-chip-low' : ''}`}
      title="HyperCBT AI credits (top up, history)"
      aria-label={`${formatCredits(spendable)} AI credits - open the credits page`}
    >
      <Sparkles size={16} />
      <span>{formatCredits(spendable)}</span>
    </Link>
  )
}

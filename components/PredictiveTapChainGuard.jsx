'use client'
/**
 * PredictiveTapChainGuard — disarms the predictive-tap chain whenever
 * the user navigates to a route that isn't in the chain whitelist.
 *
 * Without this, the chain stays armed when the user diverts off-chain
 * (settings, retreat to a non-chain page, REVIEW EDIT, NEW CYCLE, etc.).
 * Stale intents staged just before the divert can match a consume on
 * a chain page when the user navigates back, manifesting as
 * "predictive tap fires unprovoked."
 *
 * Mounted once in the root layout so it observes every navigation.
 * Disarm is idempotent — no-op when chain isn't armed, so this stays
 * cheap on non-chain pages too.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { disarmChain } from '../lib/predictiveTap'

// Pathnames that are part of the in-flight predictive-tap chain. Sub-routes
// of these (e.g., /fitness/active/[iso] for the day route, or
// /fitness/active/[iso]/[muscleId] for the muscle exercise route) are also
// considered on-chain via prefix match below.
//
// /fitness (profile selector) is INTENTIONALLY excluded — arriving
// there means "reset / start over." Disarming on /fitness ensures
// that retreating all the way back without tapping a profile leaves
// the chain in a clean state. The profile-chip tap then re-arms via
// armChain() (which clears sessionStorage + resets window state).
const CHAIN_PATH_PREFIXES = [
  '/fitness/hub',      // LOAD CYCLE option
  '/fitness/load',     // ACTIVATE popup
  '/fitness/active',   // TODAY hero + day-route + muscle-route subtree
]

function isOnChain(pathname) {
  return CHAIN_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export default function PredictiveTapChainGuard() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    if (isOnChain(pathname)) return
    disarmChain('left-chain-route')
  }, [pathname])
  return null
}

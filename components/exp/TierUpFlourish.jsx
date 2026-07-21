'use client'
/*
 * TierUpFlourish — R7 rank-up trigger. gtl1's handleStamp writes
 * pk('tier-cross-pending') with the new tier name; we read it on mount,
 * clear the flag, and play the shared RankUpSlam ("TIER UP" band +
 * tier name). The old shatter→gold-flood→sparkle cascade is retired
 * (2026-07-21, "no hokey animations") — RankUpSlam carries the same
 * P5 hard-edge language as the set cinematic.
 *
 * Mount contract unchanged: zIndex 10000 (inside RankUpSlam), paints
 * over SetXPCinematic (9995) so a tier-up dominates whatever's in
 * flight.
 */
import { useEffect, useState } from 'react'
import { pk } from '../../lib/storage'
import RankUpSlam from './RankUpSlam'

const KEY_PENDING = 'tier-cross-pending'

export default function TierUpFlourish() {
  const [tierName, setTierName] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let pending = ''
    try { pending = localStorage.getItem(pk(KEY_PENDING)) || '' } catch (_) {}
    if (!pending) return
    setTierName(pending)
    // Clear immediately — prevents a re-fire if the route re-mounts
    // mid-animation.
    try { localStorage.setItem(pk(KEY_PENDING), '') } catch (_) {}
  }, [])

  if (!tierName) return null
  return <RankUpSlam label="TIER UP" value={tierName} onDone={() => setTierName(null)} />
}

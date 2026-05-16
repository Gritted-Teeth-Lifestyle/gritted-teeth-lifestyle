// R12 / R12b / R13 — accumulated region star totals per profile.
//
// pk('region-stars') → number[5] in BODY_REGIONS index order
// (CORE / ARMS / LEGS / FRONT / BACK).
//
// Per Decision 5 (Phase 1): silent accumulation on every set save; the
// stats-page transmutation circle animates new stars on next mount.

import { pk } from '../storage'

const KEY = 'region-stars'
const ZERO = [0, 0, 0, 0, 0]

function safeRead() {
  if (typeof window === 'undefined') return [...ZERO]
  try {
    const raw = localStorage.getItem(pk(KEY))
    if (!raw) return [...ZERO]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length !== 5) return [...ZERO]
    return parsed.map(n => (Number.isFinite(n) && n >= 0) ? n : 0)
  } catch (_) {
    return [...ZERO]
  }
}

export function getRegionStars() {
  return safeRead()
}

// Add a per-set stars vector (length 5) elementwise into the running total.
// Snapshot's regionStars vector comes from resolveRegionStars and is
// already gated by the R12c star floor — sub-floor sets pass [0,0,0,0,0]
// here, which is a no-op.
export function addRegionStars(starsToAdd) {
  if (typeof window === 'undefined') return
  if (!Array.isArray(starsToAdd) || starsToAdd.length !== 5) return
  const current = safeRead()
  const next = current.map((v, i) => v + (Number.isFinite(starsToAdd[i]) ? starsToAdd[i] : 0))
  try { localStorage.setItem(pk(KEY), JSON.stringify(next)) } catch (_) {}
}

// Reset to zero — used by profile-data wipe in Settings.
export function resetRegionStars() {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(pk(KEY), JSON.stringify(ZERO)) } catch (_) {}
}

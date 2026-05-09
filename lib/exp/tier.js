// R5b/R5c/R6 — 21-tier teeth-grip ladder.
//
// Tier is determined by lifetime cumulative count of 100%-completion
// sessions (no decay, R5a). TIER_THRESHOLDS[i] = cumulative session count
// at which tier i is unlocked.
//
//   count 0   → RELAXED   ×1.00
//   count 1   → BRUSHED   ×1.06
//   count 2   → BARED     ×1.12
//   ...
//   count 100 → GRITTED   ×3.00
//
// Within a tier, the multiplier is the constant tier value (R6 — no
// within-tier ramp).

export const TIER_NAMES = [
  'RELAXED',     'BRUSHED',     'BARED',       'BRANDISHED',  'PRIMED',
  'PRESSED',     'SQUEEZED',    'LOCKED',      'DUG',         'DRIVEN',
  'CLASPED',     'CLENCHED',    'CLAMPED',     'WRENCHED',    'CALLOUSED',
  'HARDENED',    'HALLOWED',    'GNAWED',      'GNASHED',     'BLOODIED',
  'GRITTED',
]

// R5b cumulative thresholds (session count at which the tier is unlocked).
export const TIER_THRESHOLDS = [
  0,   1,   2,   4,   6,   9,   12,  16,  20,  25,
  30,  35,  41,  47,  53,  60,  67,  74,  82,  90,
  100,
]

// R5c geometric multiplier curve, ratio 3^(1/20) ≈ 1.0565.
// Values rounded to 2 decimal places to match the spec table.
export const TIER_MULTIPLIERS = [
  1.00, 1.06, 1.12, 1.18, 1.25, 1.32, 1.39, 1.47, 1.55, 1.64,
  1.73, 1.83, 1.93, 2.04, 2.16, 2.28, 2.41, 2.54, 2.69, 2.84,
  3.00,
]

export function getTierIndex(count) {
  if (!Number.isFinite(count) || count <= 0) return 0
  let idx = 0
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (count >= TIER_THRESHOLDS[i]) idx = i
    else break
  }
  return idx
}

export function getTier(count) {
  return TIER_NAMES[getTierIndex(count)]
}

export function getTierMultiplier(count) {
  return TIER_MULTIPLIERS[getTierIndex(count)]
}

// Returns the count required for the next tier-up, or null if at peak.
// e.g., getNextTierThreshold(7) → 9 (PRIMED), since 7 lands in BRANDISHED [4..5].
export function getNextTierThreshold(count) {
  const idx = getTierIndex(count)
  if (idx >= TIER_THRESHOLDS.length - 1) return null
  return TIER_THRESHOLDS[idx + 1]
}

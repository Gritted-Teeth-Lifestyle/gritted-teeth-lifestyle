// Save-slot stats for the WHO ARE YOU warrior chips: level, EXP tier,
// and days trained for ANY profile, not just the active one.
//
// Every reader in lib/exp is scoped to the active profile through pk().
// Rather than duplicate computeProfileTotalXP / tierStore / the day
// counter with an explicit prefix, profileSlotStats() swaps
// 'gtl-active-profile' to the target name for the duration of one
// synchronous computation and restores it in finally. JS is single-
// threaded and nothing here yields, so no render or event can observe
// the swapped value.

import { computeProfileTotalXP } from './setLog'
import { getTierCount } from './tierStore'
import { getTier } from './tier'
import { countTrainingDays } from './experience'

// Level curve — must match getLevelInfo in the page files (hub, active,
// ghost): threshold 150 + level×35, capped at 100.
const MAX_LEVEL = 100
export function levelFromXP(totalXP) {
  let level = 0
  let xpUsed = 0
  while (level < MAX_LEVEL) {
    const threshold = 150 + level * 35
    if (xpUsed + threshold > totalXP) return level
    xpUsed += threshold
    level++
  }
  return MAX_LEVEL
}

export function profileSlotStats(name) {
  const empty = { level: 0, tier: 'RELAXED', daysTrained: 0 }
  if (typeof window === 'undefined' || !name) return empty
  let prev = null
  try { prev = localStorage.getItem('gtl-active-profile') } catch (_) {}
  try {
    localStorage.setItem('gtl-active-profile', name)
    const { xp } = computeProfileTotalXP()
    return {
      level: levelFromXP(xp),
      tier: getTier(getTierCount()),
      daysTrained: countTrainingDays(),
    }
  } catch (_) {
    return empty
  } finally {
    try {
      if (prev == null) localStorage.removeItem('gtl-active-profile')
      else localStorage.setItem('gtl-active-profile', prev)
    } catch (_) {}
  }
}

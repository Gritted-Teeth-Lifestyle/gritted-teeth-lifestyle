// R8 / R8a — end-of-day reckoning.
//
// Computes a day's completion percentage from planned-vs-logged sets and
// returns the consistency contribution to credit (R8a — deferred credit
// applied at session close, NOT per-set).
//
// Inputs (read internally via pk()-scoped localStorage):
//   - cycle.dailyPlan[iso] → muscleId[]
//   - chips per day from pk('attunement-{cycleId}')
//   - per-exercise set-count default from pk('setcounts-{muscleId}')
//   - logged reps from pk('ex-{cycleId}-{iso}-{muscleId}')
//   - tier multiplier via getTierCount() + tier curve
//
// Output:
//   {
//     completion_pct,          // [0, 1] — sets_logged / sets_planned
//     consistency_credit,      // EOD XP credit (R8a)
//     shouldTick,              // true only on 100% completion (R5a)
//     sets_planned,
//     sets_logged,
//   }
//
// R8 thresholds:
//   < 50%   → consistency_credit = 0 (combo fizzle), no tier tick
//   50-99%  → consistency_credit = sum_today_baseXP × tierMult × completion_pct
//   100%    → consistency_credit = sum_today_baseXP × tierMult, tick tier

import { pk } from '../storage'
import { getTierCount } from './tierStore'
import { getTierMultiplier } from './tier'
import { readSetLogForDay } from './setLog'

// Default sets-per-exercise when pk('setcounts-{muscleId}') has no entry.
// Mirrors the active-page's default state ([0, 0] per exercise → 2 sets).
const DEFAULT_SETS_PER_EXERCISE = 2

function readJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (_) { return fallback }
}

// Returns the number of planned sets for the day. For each muscle in the
// dailyPlan, counts each chip's exercise once and multiplies by the
// per-exercise set-count default (from setcounts-{muscleId}, falling back
// to DEFAULT_SETS_PER_EXERCISE).
function plannedSetsForDay(cycleId, iso, dailyPlan) {
  if (typeof window === 'undefined') return 0
  const muscles = dailyPlan?.[iso] || []
  if (muscles.length === 0) return 0
  const attunement = readJSON(pk(`attunement-${cycleId}`), {})
  const dayChips = attunement?.[iso]?.chips || []
  let planned = 0
  // Group chips by muscleId would require the library; instead just use
  // the chip list directly: each chip is one exercise instance, and the
  // setcounts defaults are per-muscle. Total = chips.length × default
  // (or sum of per-exercise overrides).
  // Conservative: use per-muscle default for each chip (chip's owning
  // muscle isn't carried on the chip itself — chips know exerciseId only,
  // and the muscle/chip mapping lives in cycle.dailyPlan ordering, not on
  // the chip). For Phase 1, use DEFAULT × chips.length per muscle.
  // (R8 implementer-decision per the plan; document the chosen contract.)
  if (dayChips.length === 0) {
    // No attunement chips for this day yet — fall back to muscle count.
    // Each muscle = 1 placeholder exercise × DEFAULT sets.
    return muscles.length * DEFAULT_SETS_PER_EXERCISE
  }
  // With chips present, use them as the source of truth.
  for (const chip of dayChips) {
    // Look up the chip's muscle to read setcounts override. The chip
    // itself doesn't carry muscleId, so fall back to the global default.
    planned += DEFAULT_SETS_PER_EXERCISE
  }
  return planned
}

// Counts non-zero rep entries across all exercises logged for the day.
function loggedSetsForDay(cycleId, iso, dailyPlan) {
  if (typeof window === 'undefined') return 0
  const muscles = dailyPlan?.[iso] || []
  let logged = 0
  for (const muscleId of muscles) {
    const rData = readJSON(pk(`ex-${cycleId}-${iso}-${muscleId}`), {})
    for (const name of Object.keys(rData)) {
      const arr = Array.isArray(rData[name]) ? rData[name] : [rData[name]]
      for (const r of arr) {
        if ((r || 0) > 0) logged++
      }
    }
  }
  return logged
}

// Sums today's per-set baseXP (the "normalized base" line each set
// snapshot exposes). Used as the basis for the consistency contribution.
function sumDayBaseXP(cycleId, iso) {
  const list = readSetLogForDay(cycleId, iso)
  let total = 0
  for (const s of list) {
    if (s?.type !== 'set') continue
    if (Number.isFinite(s.baseXP)) total += s.baseXP
  }
  return total
}

export function computeDailyReckoning(cycleId, iso, dailyPlan) {
  if (!cycleId || !iso) {
    return { completion_pct: 0, consistency_credit: 0, shouldTick: false, sets_planned: 0, sets_logged: 0 }
  }
  const sets_planned = plannedSetsForDay(cycleId, iso, dailyPlan)
  const sets_logged  = loggedSetsForDay(cycleId, iso, dailyPlan)

  if (sets_planned <= 0) {
    return { completion_pct: 0, consistency_credit: 0, shouldTick: false, sets_planned, sets_logged }
  }

  const completion_pct = Math.min(1, sets_logged / sets_planned)
  const tierMult = getTierMultiplier(getTierCount())
  const baseXP = sumDayBaseXP(cycleId, iso)

  // R8 thresholds.
  if (completion_pct < 0.5) {
    return { completion_pct, consistency_credit: 0, shouldTick: false, sets_planned, sets_logged }
  }
  // 50-99% scales linearly; 100% applies in full + ticks tier (R5a).
  const isFull = completion_pct >= 1.0
  const consistency_credit = baseXP * tierMult * completion_pct
  return {
    completion_pct,
    consistency_credit,
    shouldTick: isFull,
    sets_planned,
    sets_logged,
  }
}

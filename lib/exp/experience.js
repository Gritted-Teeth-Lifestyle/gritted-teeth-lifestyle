// LIFTING EXPERIENCE — per-tier bands for the STATUS QUO honesty layer
// (Jordan's design, 2026-07-22).
//
// One question at profile creation: "How long have you been lifting?"
// days / weeks / months / years / decades. The answer only sets
// EXPECTATIONS — it can never earn extra EXP, only move where the honesty
// bands sit. Lying hurts in both directions:
//
//   - Beginner claims "decades": keeps the full 2.0 ceiling but loses all
//     jump forgiveness — natural newbie gains read as implausible-for-a-
//     veteran and get taxed constantly.
//   - Veteran claims "days": his real numbers sit above the beginner
//     ceiling (1.3× standard) and get rejected outright.
//
// Truth-telling is the dominant strategy, which is the whole point of
// asking.
//
// The claim is only a STARTING point. Effective tier = the higher of the
// claim and the tier EARNED from countTrainingDays() (distinct calendar
// days with logged sets, whole profile history). Earned tiers ratchet up
// only; 'decades' is claim-only — you don't earn that inside the app.
// Per PROFILE, not per cycle — experience belongs to the lifter, and
// running parallel cycles can't speed-run tiers (day count is distinct
// dates).
//
// Band semantics (consumed by assessSet in statusQuo.js):
//   taxStart      — claim (est-1RM / standard) at which jump-taxing begins.
//                   Below it, no questions — except see taxBelowStart.
//   reject        — claim at which the input is blocked as a data error.
//                   Beginners can't legitimately be near the advanced
//                   standard, so their ceiling is far lower than 2.0×.
//   jumpTol       — allowed est-1RM growth vs provenBest before tax.
//                   Beginners double lifts in months (newbie gains);
//                   veterans don't leap 15% overnight.
//   taxBelowStart — decades only: jumps beyond jumpTol are taxed even
//                   below the standard (needs a proven record to compare
//                   against — a first-ever session has no jump to judge).
//
// 'years' IS the pre-experience system: its row reproduces the original
// statusQuo constants exactly, and an unset claim resolves to 'years', so
// existing profiles behave identically until they answer the question.

import { pk } from '../storage'

const KEY = 'lifting-experience'

export const EXPERIENCE_TIERS = ['days', 'weeks', 'months', 'years', 'decades']

export const EXPERIENCE_BANDS = {
  days:    { taxStart: 0.7, reject: 1.3, jumpTol: 2.0,  taxBelowStart: false },
  weeks:   { taxStart: 0.8, reject: 1.5, jumpTol: 1.6,  taxBelowStart: false },
  months:  { taxStart: 0.9, reject: 1.7, jumpTol: 1.4,  taxBelowStart: false },
  years:   { taxStart: 1.0, reject: 2.0, jumpTol: 1.3,  taxBelowStart: false },
  decades: { taxStart: 1.0, reject: 2.0, jumpTol: 1.15, taxBelowStart: true },
}

// Stamped-day thresholds for EARNED tiers. 'decades' is deliberately
// absent — claim-only.
const EARNED_THRESHOLDS = [
  ['years', 150],
  ['months', 40],
  ['weeks', 10],
]

export function getClaimedExperience() {
  try {
    const v = localStorage.getItem(pk(KEY))
    return EXPERIENCE_TIERS.includes(v) ? v : null
  } catch (_) { return null }
}

export function setClaimedExperience(tier) {
  if (!EXPERIENCE_TIERS.includes(tier)) return
  try { localStorage.setItem(pk(KEY), tier) } catch (_) {}
}

// Total training days on this profile — CALENDAR days with at least
// one logged set, across ALL cycles (including deleted ones): every
// trained day leaves a pk('xpLog-{cycleId}-{iso}') key behind, so this
// is a prefix scan, retroactive over the profile's whole history.
// Distinct ISO dates, not keys — two cycles running in parallel on the
// same date is still ONE day trained. The iso is the fixed-length
// YYYY-MM-DD tail of the key (cycleIds can contain hyphens, so parse
// from the end). Feeds the WAR RECORD stat and the earned experience
// tier.
export function countTrainingDays() {
  try {
    const prefix = pk('xpLog-')
    const days = new Set()
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(prefix)) continue
      const iso = k.slice(-10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) days.add(iso)
    }
    return days.size
  } catch (_) { return 0 }
}

export function earnedExperienceTier(dayCount) {
  const n = Number(dayCount) || 0
  for (const [tier, min] of EARNED_THRESHOLDS) {
    if (n >= min) return tier
  }
  return 'days'
}

// max(claimed, earned) by tier order. Unset claim → 'years' (the original
// system) so pre-experience profiles are untouched until they answer.
export function getEffectiveExperience() {
  const claimed = getClaimedExperience() || 'years'
  const earned = earnedExperienceTier(countTrainingDays())
  const idx = Math.max(
    EXPERIENCE_TIERS.indexOf(claimed),
    EXPERIENCE_TIERS.indexOf(earned),
  )
  return EXPERIENCE_TIERS[idx]
}

export function getExperienceBands(tier) {
  return EXPERIENCE_BANDS[tier] || EXPERIENCE_BANDS.years
}

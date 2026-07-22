// STATUS QUO — honesty layer over set logging (Jordan's design, 2026-07-20).
//
// Every set is translated to an estimated 1RM (Epley, reps capped at 12 —
// the formula is unreliable past ~10 and the cap stops honest burnout sets
// from inflating into false positives) and compared against two anchors:
//
//   standard   = heavy_lift_threshold × min(bodyweight, 250)
//                (the exercise's ADVANCED-standard 1RM for this lifter;
//                 the 250 cap follows the strength-standards convention
//                 that BW ratios break down for very heavy lifters)
//   provenBest = highest est-1RM from any COMPLETED PRIOR session,
//                per exercise, per profile. NOT per cycle — strength
//                belongs to the lifter, not the program. Wiping the
//                slate = making a new profile.
//
// Bands (calibrated to Nippard strength tiers: advanced/elite/freak ≈
// 1.0 / 1.35 / 1.5 × the advanced standard; 2× is beyond any recorded
// human, so it's a data error, not ambition). Shown here at the default
// 'years' experience tier — the reject line, tax start, and jump
// tolerance all shift with the profile's lifting-experience tier (see
// lib/exp/experience.js):
//
//   claim ≥ reject (2.0)              → 'reject' (block the input)
//   claim < taxStart (1.0)            → honest zone, never questioned
//                                       (decades tier: jumps taxed here too)
//   jump ≤ jumpTol (1.3)              → believed, never taxed
//   jump > jumpTol & claim < 1.35     → 'tax' ×0.75
//   jump > jumpTol & claim 1.35–1.5   → 'tax' ×0.5
//   jump > jumpTol & claim > 1.5      → 'tax' ×0.25
//
// CLIMB bonus: est-1RM within 0.9–1.1× provenBest and not taxed → ×1.1.
// Rewards both the +5lb PR and the honest grind at your working weight —
// the EXP-optimal strategy is deliberately identical to real progressive
// overload. First-ever session has no provenBest → no bonus: you
// establish the status quo before you climb from it.
//
// TOO LIGHT: relative load under 20% of threshold → 'light' flag (soft
// nudge only, sets still earn XP — warm-ups and rehab are legitimate).
// Never fires for bodyweight moves at zero added weight (the coefficient
// already carries the load).
//
// Baseline update happens ONLY at day-stamp (BRING ON TOMORROW), capped
// at ×1.3 growth per stamp — a big lie must be re-logged (and re-taxed)
// across multiple sessions before it becomes the new status quo. The
// baseline never decays: comeback lifters below their record are never
// questioned, only claims above it are.

import { pk } from '../storage'
import { readSetLogForDay } from './setLog'
import { getEffectiveExperience, getExperienceBands } from './experience'

const KEY = 'proven-best'

const EPLEY_REP_CAP = 12
// Default bands = the 'years' experience tier (the original system).
// Per-tier overrides live in lib/exp/experience.js and arrive via the
// `bands` param on assessSet.
const DEFAULT_BANDS = { taxStart: 1.0, reject: 2.0, jumpTol: 1.3, taxBelowStart: false }
const CLIMB_LO = 0.9
const CLIMB_HI = 1.1
const CLIMB_MULT = 1.1
const LIGHT_FRACTION = 0.2
const BW_CAP = 250
const BASELINE_GROWTH_CAP = 1.3

export function est1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Math.max(1, Math.min(EPLEY_REP_CAP, Number(reps) || 1))
  return w * (1 + r / 30)
}

// Effective load for the claim: bodyweight moves carry coeff × BW on top
// of any added weight (mirrors R1a's load model).
function loadFor(exercise, weight, bodyweight) {
  const added = Number(weight) || 0
  if (exercise?.equipment === 'bodyweight') {
    const coeff = exercise?.bw_coefficient ?? 1.0
    return coeff * bodyweight + added
  }
  return added
}

export function readProvenBests() {
  try {
    const raw = localStorage.getItem(pk(KEY))
    const map = raw ? JSON.parse(raw) : {}
    return map && typeof map === 'object' ? map : {}
  } catch (_) { return {} }
}

export function getProvenBest(exerciseId) {
  const v = readProvenBests()[exerciseId]
  return Number.isFinite(v) && v > 0 ? v : null
}

// Pure assessment. Returns:
//   { kind: 'reject'|'tax'|'climb'|'none', mult, claim, jump, light,
//     standard, provenBest }
// Skips entirely (kind 'none', mult 1) when bodyweight or threshold is
// unknown — no data, no judgment.
export function assessSet({ exercise, weight, reps, bodyweight, provenBest, bands }) {
  const b = bands || DEFAULT_BANDS
  const out = { kind: 'none', mult: 1.0, claim: 0, jump: 0, light: false, standard: 0, provenBest: provenBest ?? null }
  const threshold = exercise?.heavy_lift_threshold ?? 0
  const bw = Number(bodyweight) || 0
  if (!(threshold > 0) || !(bw > 0)) return out

  const standard = threshold * Math.min(bw, BW_CAP)
  const load = loadFor(exercise, weight, bodyweight)
  const est = est1RM(load, reps)
  const claim = est / standard
  out.standard = standard
  out.claim = claim

  // TOO LIGHT nudge — external-load moves only (added-weight 0 on a BW
  // move is normal), and only when something was actually entered.
  if (exercise?.equipment !== 'bodyweight' && (Number(weight) || 0) > 0) {
    out.light = (load / Math.min(bw, BW_CAP)) < threshold * LIGHT_FRACTION
  }

  if (claim >= b.reject) {
    out.kind = 'reject'
    out.mult = 0
    return out
  }

  const proven = Number.isFinite(provenBest) && provenBest > 0 ? provenBest : null
  const jump = proven ? est / proven : Infinity
  out.jump = proven ? jump : 0

  // Honest zone: below the tier's taxStart, no questions — except the
  // decades tier, where jumps beyond tolerance are taxed even below the
  // standard (veterans don't leap overnight). That case needs a proven
  // record: a first-ever session has no jump to judge.
  // Above taxStart, a gradual climber (jump ≤ jumpTol vs proven history)
  // is believed; only claims that outrun their own record get taxed.
  const inTaxZone = claim >= b.taxStart || (b.taxBelowStart && proven)
  const taxed = inTaxZone && jump > b.jumpTol
  if (taxed) {
    out.kind = 'tax'
    out.mult = claim > 1.5 ? 0.25 : claim >= 1.35 ? 0.5 : 0.75
    return out
  }

  if (proven && est >= CLIMB_LO * proven && est <= CLIMB_HI * proven) {
    out.kind = 'climb'
    out.mult = CLIMB_MULT
  } else if (!proven && claim < 1.0) {
    // NEW CYCLE grace (Jordan 2026-07-21): no record yet — any plausible
    // (sub-advanced) weight earns the same bonus while the baseline is
    // being established. Once the first day is stamped and a record
    // exists, the OVERLOAD zone takes over.
    out.kind = 'fresh'
    out.mult = CLIMB_MULT
  }
  return out
}

// Convenience: assessment with provenBest read from storage and bands
// resolved from the profile's effective lifting-experience tier
// (lib/exp/experience.js — max of claimed and earned-from-day-count).
export function assessSetForExercise(exercise, weight, reps, bodyweight) {
  return assessSet({
    exercise, weight, reps, bodyweight,
    provenBest: exercise?.id ? getProvenBest(exercise.id) : null,
    bands: getExperienceBands(getEffectiveExperience()),
  })
}

// Day-stamp hook: fold today's best est-1RM per exercise into the proven
// baselines, growth capped at ×1.3 per stamp. Idempotent for a given
// day's data (max() and the cap make re-stamps harmless).
export function updateProvenBestsFromDay(cycleId, iso, exercises = { getExerciseById: null }) {
  let bests
  try { bests = readProvenBests() } catch (_) { return }
  const todayBest = {}
  let list = []
  try { list = readSetLogForDay(cycleId, iso) } catch (_) { return }
  for (const e of list) {
    if (e?.type !== 'set' || !e.exerciseName) continue
    let load = Number(e.weight) || 0
    // Bodyweight moves: recover the effective load from the snapshot's
    // rawBase when possible (rawBase = load × repMult × reps, display
    // scale 1/100) — avoids needing a library lookup here.
    const getEx = exercises?.getExerciseById
    if (getEx) {
      const ex = getEx(e.exerciseName)
      if (ex?.equipment === 'bodyweight') {
        let bw = 0
        try { bw = parseInt(localStorage.getItem(pk('user-bodyweight')), 10) || 0 } catch (_) {}
        load = (ex.bw_coefficient ?? 1.0) * bw + (Number(e.weight) || 0)
      }
    }
    const est = est1RM(load, e.reps)
    if (est > (todayBest[e.exerciseName] || 0)) todayBest[e.exerciseName] = est
  }
  let changed = false
  for (const [name, est] of Object.entries(todayBest)) {
    const old = Number(bests[name]) || 0
    const next = old > 0 ? Math.max(old, Math.min(est, old * BASELINE_GROWTH_CAP)) : est
    if (next !== old) { bests[name] = Math.round(next * 10) / 10; changed = true }
  }
  if (changed) {
    try { localStorage.setItem(pk(KEY), JSON.stringify(bests)) } catch (_) {}
  }
}

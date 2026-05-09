// R1, R1a, R2, R3, R10/R10a, R12/R12b/R12c/R13/R14, R18/R18a — per-set XP
// orchestrator.
//
// calculateSetXP({reps, weight}, exercise, user, runtimeState) is a PURE
// function. No localStorage reads. All state is passed in:
//
//   set       = { reps, weight }                              // user-entered
//   exercise  = library entry (primaryMuscles, secondaryMuscles,
//               equipment, bw_coefficient?, heavy_lift_threshold,
//               heavy_lift_scale, is_king_compound?,
//               is_isolation_override?)
//   user      = { bodyweight (lb), sex ('m'|'f'), dob? }
//   runtime   = { tierMult, prestigeMult, holidayMult }
//
// Math (R1 + R1a):
//   External-load: effective_load = entered_weight × norm_factor
//   Bodyweight   : effective_load = REFERENCE_BW × bw_coefficient
//                                 + entered_weight × norm_factor
//   base = effective_load × repMult(reps) × reps
//   norm_factor = ipfGL(user_BW_kg) / ipfGL(REFERENCE_BW_kg)
//
// HEAVY LIFT (R18a):
//   relative_load   = bw_coefficient + entered_weight / user_BW
//   heavy_lift_x    = max(0, relative_load - threshold) × scale
//   combined_factor = norm_factor × (1 + heavy_lift_x)
//   When combined > 1, the cinematic shows a HEAVY LIFT bonus line equal
//   to entered_weight × (combined - 1) × repMult × reps. The full multiplier
//   stack operates on the post-bonus base (called stackBase below).
//
// R2 strict: per-set total = sum of base × multiplier contributions.
// R8a defers consistency contribution to end-of-day reckoning, so per-set
// totalXP excludes that line. The snapshot exposes consistencyMult (current
// tier value) so the cinematic can render the line; the actual credit lands
// via a separate {type: 'consistency-credit'} reckoning entry.

import { repMult } from './repMult'
import { bodyweightNormFactor, REFERENCE_BW } from './ipfGL'
import { regionWeights } from './regions'
import { STAR_FLOOR_FRACTION } from '../exerciseAliases'

// Class multipliers (R2). king_compound > compound > isolation.
const CLASS_MULT = {
  king_compound: 1.75,
  compound:      1.5,
  isolation:     1.2,
}

// R18a class scales for HEAVY LIFT bonus magnitude.
const CLASS_SCALE = {
  isolation:     1.5,
  compound:      1.0,
  king_compound: 0.7,
}

// R14 auto-classifier with R10a region map applied via regionWeights.
// Auto rule: if 100% of the region weight lands in a single region,
// default to isolation. Otherwise compound. Curator overrides via
// is_king_compound and is_isolation_override take precedence.
export function classifyExercise(exercise) {
  if (exercise?.is_king_compound) return 'king_compound'
  if (exercise?.is_isolation_override) return 'isolation'
  const weights = regionWeights(exercise)
  const nonZero = weights.filter(w => w > 0).length
  return nonZero <= 1 ? 'isolation' : 'compound'
}

// Discrete star award per R12 / R12b / R13.
// Tiebreak (R12 amended 2026-05-06): hand-curated splits eliminate ties;
// alphabetical by region id is the deterministic fallback.
// Region indices: 0=core 1=arms 2=legs 3=front 4=back.
// Alphabetical sort by id: arms(1) < back(4) < core(0) < front(3) < legs(2).
const ALPHA_RANK = [2, 0, 4, 3, 1]  // ALPHA_RANK[regionIndex] = alphabetical rank

function topNRegions(weights, n) {
  const idxs = weights.map((_, i) => i)
    .filter(i => weights[i] > 0)
    .sort((a, b) => {
      if (weights[b] !== weights[a]) return weights[b] - weights[a]
      return ALPHA_RANK[a] - ALPHA_RANK[b]
    })
  return idxs.slice(0, n)
}

export function resolveRegionStars(exercise, regionWeightVec, earnsStars) {
  const out = [0, 0, 0, 0, 0]
  if (!earnsStars) return out
  const cls = classifyExercise(exercise)
  if (cls === 'isolation') {
    const top = topNRegions(regionWeightVec, 1)
    if (top.length > 0) out[top[0]] = 2          // R13
  } else if (cls === 'king_compound') {
    for (const i of topNRegions(regionWeightVec, 3)) out[i] = 1   // R12b
  } else {
    for (const i of topNRegions(regionWeightVec, 2)) out[i] = 1   // R12
  }
  return out
}

export function calculateSetXP(set, exercise, user, runtimeState = {}) {
  const reps = set?.reps || 0
  const weight = set?.weight || 0
  const cls = classifyExercise(exercise)

  const sex = user?.sex || 'm'
  const bw = user?.bodyweight

  // R1a: norm_factor.
  const normFactor = (Number.isFinite(bw) && bw > 0)
    ? bodyweightNormFactor(bw, sex)
    : 1.0

  const bw_coeff = exercise?.bw_coefficient ?? 0
  const isBW = exercise?.equipment === 'bodyweight'

  const mult = repMult(reps)

  // R18a: relative_load + combined_factor.
  const threshold = exercise?.heavy_lift_threshold ?? 0
  const scale = exercise?.heavy_lift_scale ?? CLASS_SCALE[cls] ?? 1.0
  const relative_load = (Number.isFinite(bw) && bw > 0)
    ? bw_coeff + weight / bw
    : 0
  const heavy_excess = threshold > 0
    ? Math.max(0, relative_load - threshold) * scale
    : 0
  const combinedFactor = normFactor * (1 + heavy_excess)

  // The "raw base" line shown first in the cinematic = what the user
  // physically lifted, no normalization.
  //   External: rawBase = entered_weight × repMult × reps
  //   BW      : rawBase = (REFERENCE_BW × bw_coefficient + entered_weight) × repMult × reps
  // For external with no entered weight, fall back to reps × mult to match
  // legacy behavior (BW-style fallback for exercises with no load).
  const bwLoad = REFERENCE_BW * bw_coeff
  const rawBase = isBW
    ? (bwLoad + weight) * mult * reps
    : (weight > 0 ? weight * mult * reps : reps * mult)

  // stackBase = effective_load × repMult × reps (the multiplier-applying base).
  // Per R1a:
  //   External: effective_load = entered_weight × combined_factor
  //   BW      : effective_load = REFERENCE_BW × bw_coefficient
  //                            + entered_weight × combined_factor
  // (combined_factor folds in both norm_factor and the heavy_lift bonus.)
  const stackBase = isBW
    ? (bwLoad + weight * combinedFactor) * mult * reps
    : (weight > 0 ? weight * combinedFactor * mult * reps : reps * mult)

  // Visible HEAVY LIFT bonus = stackBase - rawBase when combined > 1.
  // (Only fires the cinematic line in that case; otherwise normalization
  // happens silently per R18a UI semantics.)
  const heavyLiftBonus = combinedFactor > 1 ? Math.max(0, stackBase - rawBase) : 0

  // R2 strict: per-set total = sum of base × multiplier contributions.
  // R8a: consistency contribution is deferred. The snapshot records
  // consistencyMult for the cinematic, but totalXP excludes it.
  const classMult       = CLASS_MULT[cls] ?? CLASS_MULT.compound
  const tierMult        = runtimeState.tierMult ?? 1.0
  const prestigeMult    = runtimeState.prestigeMult ?? 0
  const holidayMult     = runtimeState.holidayMult ?? 0

  const totalXP =
      stackBase * classMult         // R2 class contribution
    + stackBase * prestigeMult      // R2 prestige contribution (0 if no ribbons)
    + stackBase * holidayMult       // R2 holiday contribution (0 if no holiday)

  // R12c star floor.
  const star_floor = STAR_FLOOR_FRACTION * threshold
  const earnsStars = threshold > 0 && relative_load >= star_floor

  const regionWeightVec = regionWeights(exercise)
  const regionStars = resolveRegionStars(exercise, regionWeightVec, earnsStars)

  return {
    type: 'set',
    ts: Date.now(),
    reps,
    weight,
    rawBase,
    baseXP: stackBase,            // "normalized base" the cinematic shows
    normFactor,
    heavyLiftBonus,
    combinedFactor,
    classification: cls,
    classMult,
    consistencyMult: tierMult,    // for cinematic; actual credit applied at EOD per R8a
    prestigeMult,
    holidayMult,
    totalXP,                      // R2 sum of contributions; consistency deferred
    regionWeights: regionWeightVec,
    regionStars,
    earnsStars,
    relative_load,
    star_floor,
  }
}

import { describe, test, expect } from 'vitest'
import { calculateSetXP, classifyExercise, resolveRegionStars } from '../../lib/exp/setXP'
import { regionWeights, REGION_INDEX } from '../../lib/exp/regions'

// Library entries pulled from current MUSCLE_FIXUP / KING_COMPOUNDS /
// HEAVY_LIFT_THRESHOLDS in lib/exerciseAliases.js — kept inline here so
// these tests don't depend on the auto-generated lib/exerciseLibrary.js.

const BENCH_PRESS = {
  id: 'BENCH PRESS',
  equipment: 'barbell',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['shoulders', 'triceps'],
  heavy_lift_threshold: 1.5,
  heavy_lift_scale: 1.0,
}

const DEADLIFTS = {
  id: 'DEADLIFTS',
  equipment: 'barbell',
  primaryMuscles: ['back'],
  secondaryMuscles: ['glutes', 'hamstrings', 'abs'],
  heavy_lift_threshold: 2.0,
  heavy_lift_scale: 0.7,
  is_king_compound: true,
}

const BICEPS_CURL = {
  id: 'BICEPS CURLS WITH BARBELL',
  equipment: 'barbell',
  primaryMuscles: ['biceps'],
  secondaryMuscles: [],
  heavy_lift_threshold: 0.45,
  heavy_lift_scale: 1.5,
}

const HIP_THRUST = {
  id: 'BARBELL HIP THRUST',
  equipment: 'barbell',
  primaryMuscles: ['glutes'],
  secondaryMuscles: ['hamstrings'],
  heavy_lift_threshold: 2.0,
  heavy_lift_scale: 1.5,
  is_isolation_override: true,
}

describe('classifyExercise', () => {
  test('BENCH PRESS → compound', () => {
    expect(classifyExercise(BENCH_PRESS)).toBe('compound')
  })
  test('DEADLIFTS (king compound flag) → king_compound', () => {
    expect(classifyExercise(DEADLIFTS)).toBe('king_compound')
  })
  test('BICEPS CURL (single primary, no secondary) → isolation', () => {
    expect(classifyExercise(BICEPS_CURL)).toBe('isolation')
  })
  test('HIP THRUST (override flag) → isolation', () => {
    expect(classifyExercise(HIP_THRUST)).toBe('isolation')
  })
})

describe('resolveRegionStars', () => {
  test('compound → top 2 regions × 1★', () => {
    const w = regionWeights(BENCH_PRESS)  // FRONT 0.6 / ARMS 0.4
    const stars = resolveRegionStars(BENCH_PRESS, w, true)
    expect(stars[REGION_INDEX.front]).toBe(1)
    expect(stars[REGION_INDEX.arms]).toBe(1)
    expect(stars.reduce((s, x) => s + x, 0)).toBe(2)
  })
  test('king compound → top 3 regions × 1★', () => {
    const w = regionWeights(DEADLIFTS)   // BACK 0.733 / LEGS 0.133 / CORE 0.133
    const stars = resolveRegionStars(DEADLIFTS, w, true)
    expect(stars[REGION_INDEX.back]).toBe(1)
    expect(stars[REGION_INDEX.legs]).toBe(1)
    expect(stars[REGION_INDEX.core]).toBe(1)
    expect(stars.reduce((s, x) => s + x, 0)).toBe(3)
  })
  test('isolation → top 1 region × 2★', () => {
    const w = regionWeights(BICEPS_CURL)  // ARMS 1.0
    const stars = resolveRegionStars(BICEPS_CURL, w, true)
    expect(stars[REGION_INDEX.arms]).toBe(2)
    expect(stars.reduce((s, x) => s + x, 0)).toBe(2)
  })
  test('hip thrust override → LEGS 2★ (isolation, top region)', () => {
    const w = regionWeights(HIP_THRUST)  // LEGS 0.6 / BACK 0.4
    const stars = resolveRegionStars(HIP_THRUST, w, true)
    expect(stars[REGION_INDEX.legs]).toBe(2)
    expect(stars.reduce((s, x) => s + x, 0)).toBe(2)
  })
  test('earnsStars=false → all zero regardless of class', () => {
    const w = regionWeights(BENCH_PRESS)
    expect(resolveRegionStars(BENCH_PRESS, w, false)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('calculateSetXP — golden vectors', () => {
  test('BENCH 135 × 10 at 200 lb male, RELAXED, no holiday, no ribbons (R2 strict, consistency deferred per R8a)', () => {
    const snap = calculateSetXP(
      { reps: 10, weight: 135 },
      BENCH_PRESS,
      { bodyweight: 200, sex: 'm' },
      { tierMult: 1.0, prestigeMult: 0, holidayMult: 0 },
    )
    // norm_factor ≈ 0.949; relative_load 0.675 < threshold 1.5 → no heavy bonus
    expect(snap.normFactor).toBeCloseTo(0.95, 2)
    expect(snap.combinedFactor).toBeCloseTo(snap.normFactor, 5)
    expect(snap.heavyLiftBonus).toBe(0)
    expect(snap.rawBase).toBe(1350)
    // stackBase = 135 × normFactor × 1.0 × 10
    expect(snap.baseXP).toBeCloseTo(1350 * snap.normFactor, 5)
    // R2 totalXP = stackBase × class (1.5) + 0 + 0
    expect(snap.totalXP).toBeCloseTo(snap.baseXP * 1.5, 5)
    // R12c gate: relative_load 0.675 < star_floor 1.125 → no stars
    expect(snap.earnsStars).toBe(false)
    expect(snap.regionStars).toEqual([0, 0, 0, 0, 0])
    expect(snap.classification).toBe('compound')
    expect(snap.consistencyMult).toBe(1.0)  // RELAXED, deferred to EOD
  })

  test('DEADLIFTS 315 × 5 at 200 lb male, HARDENED tier (×2.28), 5 ribbons (×0.50), no holiday', () => {
    const snap = calculateSetXP(
      { reps: 5, weight: 315 },
      DEADLIFTS,
      { bodyweight: 200, sex: 'm' },
      { tierMult: 2.28, prestigeMult: 0.50, holidayMult: 0 },
    )
    // 315/200 = 1.575 < threshold 2.0 → no heavy bonus
    expect(snap.heavyLiftBonus).toBe(0)
    // stackBase = 315 × normFactor × 1.0 × 5
    expect(snap.baseXP).toBeCloseTo(1575 * snap.normFactor, 5)
    // R2 totalXP (king 1.75 + prestige 0.50, consistency deferred)
    expect(snap.totalXP).toBeCloseTo(snap.baseXP * 1.75 + snap.baseXP * 0.50, 5)
    // star_floor = 0.75 × 2.0 = 1.5; relative_load 1.575 ≥ 1.5 → stars earned
    expect(snap.earnsStars).toBe(true)
    // King compound: top 3 wger regions × 1★ each → BACK + LEGS + CORE
    expect(snap.regionStars[REGION_INDEX.back]).toBe(1)
    expect(snap.regionStars[REGION_INDEX.legs]).toBe(1)
    expect(snap.regionStars[REGION_INDEX.core]).toBe(1)
    expect(snap.regionStars.reduce((s, x) => s + x, 0)).toBe(3)
    expect(snap.classification).toBe('king_compound')
    expect(snap.classMult).toBe(1.75)
    expect(snap.consistencyMult).toBe(2.28)
  })

  test('BENCH 225 × 5 at 145 lb male — earnsStars + HEAVY LIFT bonus > 0', () => {
    const snap = calculateSetXP(
      { reps: 5, weight: 225 },
      BENCH_PRESS,
      { bodyweight: 145, sex: 'm' },
      { tierMult: 1.0, prestigeMult: 0, holidayMult: 0 },
    )
    // norm_factor ~1.13 (lighter); relative_load 225/145 ≈ 1.552 > threshold 1.5
    expect(snap.normFactor).toBeGreaterThan(1)
    expect(snap.relative_load).toBeCloseTo(225 / 145, 5)
    expect(snap.combinedFactor).toBeGreaterThan(1)
    expect(snap.heavyLiftBonus).toBeGreaterThan(0)
    // star_floor = 1.125 < 1.552 → stars earned
    expect(snap.earnsStars).toBe(true)
    expect(snap.regionStars[REGION_INDEX.front]).toBe(1)
    expect(snap.regionStars[REGION_INDEX.arms]).toBe(1)
  })

  test('BENCH 135 × 10 at 200 lb male (warm-up) — earnsStars false; no HEAVY LIFT line; XP still computes', () => {
    const snap = calculateSetXP(
      { reps: 10, weight: 135 },
      BENCH_PRESS,
      { bodyweight: 200, sex: 'm' },
      { tierMult: 1.32, prestigeMult: 0, holidayMult: 0 },
    )
    expect(snap.earnsStars).toBe(false)
    expect(snap.heavyLiftBonus).toBe(0)
    expect(snap.regionStars).toEqual([0, 0, 0, 0, 0])
    expect(snap.totalXP).toBeGreaterThan(0)
  })

  test('BICEPS CURL 60 × 8 at 180 lb male — isolation, ARMS 2★, R12c gate', () => {
    const snap = calculateSetXP(
      { reps: 8, weight: 60 },
      BICEPS_CURL,
      { bodyweight: 180, sex: 'm' },
      { tierMult: 1.0, prestigeMult: 0, holidayMult: 0 },
    )
    expect(snap.classification).toBe('isolation')
    expect(snap.classMult).toBe(1.2)
    // 180 lb at REFERENCE → norm_factor = 1.0
    expect(snap.normFactor).toBeCloseTo(1.0, 3)
    // relative_load 60/180 = 0.333 < star_floor 0.3375 → no stars
    expect(snap.earnsStars).toBe(false)
  })

  test('snapshot shape — required fields present', () => {
    const snap = calculateSetXP({ reps: 5, weight: 100 }, BENCH_PRESS, { bodyweight: 180, sex: 'm' }, {})
    expect(snap.type).toBe('set')
    expect(typeof snap.ts).toBe('number')
    expect(typeof snap.totalXP).toBe('number')
    expect(Array.isArray(snap.regionWeights)).toBe(true)
    expect(snap.regionWeights.length).toBe(5)
    expect(Array.isArray(snap.regionStars)).toBe(true)
    expect(snap.regionStars.length).toBe(5)
  })

  test('R8a — consistency contribution is deferred (not in totalXP)', () => {
    // GRITTED tier (×3.00) — consistency would be a huge contribution if
    // included. Verify totalXP excludes it.
    const snap = calculateSetXP(
      { reps: 5, weight: 100 },
      BENCH_PRESS,
      { bodyweight: 180, sex: 'm' },
      { tierMult: 3.00, prestigeMult: 0, holidayMult: 0 },
    )
    // baseXP = 100 × 1.0 × 1.0 × 5 = 500. Compound class mult = 1.5.
    // totalXP should be 500 × 1.5 = 750 (NOT 500 × 1.5 + 500 × 3.0 = 2250).
    expect(snap.baseXP).toBeCloseTo(500, 5)
    expect(snap.totalXP).toBeCloseTo(750, 5)
    expect(snap.consistencyMult).toBe(3.00)  // recorded for cinematic only
  })
})
